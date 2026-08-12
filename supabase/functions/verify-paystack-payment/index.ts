import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VerificationRequest = {
  reference?: string;
  paymentType?: "booking" | "order";
  bookingId?: string;
  amount?: number;
  items?: unknown[];
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("You must be signed in.");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("You must be signed in.");

    const body = (await request.json()) as VerificationRequest;
    if (!body.reference || !body.paymentType) throw new Error("Payment reference and type are required.");
    if (!/^[-_a-zA-Z0-9]+$/.test(body.reference)) throw new Error("Invalid payment reference.");

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) throw new Error("Paystack is not configured on the server.");

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(body.reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } },
    );
    const paystack = await paystackResponse.json();
    const transaction = paystack?.data;
    if (!paystackResponse.ok || !paystack?.status || transaction?.status !== "success") {
      throw new Error("Paystack could not verify this payment.");
    }
    if (transaction.currency !== "ZAR") throw new Error("The payment currency does not match this checkout.");
    if (transaction.customer?.email?.toLowerCase() !== user.email?.toLowerCase()) {
      throw new Error("This payment belongs to a different customer.");
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: existingPayment, error: existingPaymentError } = await adminClient
      .from("paystack_payments")
      .select("user_id, payment_type, booking_id, order_id")
      .eq("reference", body.reference)
      .maybeSingle();
    if (existingPaymentError) throw existingPaymentError;
    if (existingPayment) {
      if (existingPayment.user_id !== user.id) throw new Error("This payment has already been used.");
      return Response.json({ success: true, bookingId: existingPayment.booking_id, orderId: existingPayment.order_id }, { headers: corsHeaders });
    }

    if (body.paymentType === "booking") {
      if (!body.bookingId) throw new Error("Booking ID is required.");
      const { data: booking, error: bookingError } = await adminClient
        .from("bookings")
        .select("id, user_id, amount, queue_position, payment_status")
        .eq("id", body.bookingId)
        .maybeSingle();
      if (bookingError || !booking) throw new Error("Booking not found.");
      if (booking.user_id !== user.id) throw new Error("You cannot pay for this booking.");
      if (Math.round(Number(booking.amount) * 100) !== transaction.amount) throw new Error("The payment amount does not match this booking.");

      const { data: queuedBookings, error: queueError } = await adminClient
        .from("bookings")
        .select("queue_position")
        .in("status", ["confirmed", "in_queue", "in_progress"])
        .order("queue_position", { ascending: false })
        .limit(1);
      if (queueError) throw queueError;
      const queuePosition = booking.queue_position ?? (queuedBookings?.[0]?.queue_position ?? 0) + 1;

      const { error: updateError } = await adminClient
        .from("bookings")
        .update({ payment_status: "paid", status: "in_queue", queue_position: queuePosition })
        .eq("id", booking.id);
      if (updateError) throw updateError;

      const { error: notificationError } = await adminClient.from("notifications").insert({
        user_id: user.id,
        title: "Your car is ready to be washed",
        message: "Your slot is paid and reserved. Your car is now in the queue and will be washed soon.",
        type: "booking",
      });
      if (notificationError) throw notificationError;

      const { error: paymentError } = await adminClient.from("paystack_payments").insert({
        reference: body.reference,
        user_id: user.id,
        payment_type: "booking",
        booking_id: booking.id,
        amount: transaction.amount,
        currency: transaction.currency,
      });
      if (paymentError) throw paymentError;
      return Response.json({ success: true, bookingId: booking.id }, { headers: corsHeaders });
    }

    const orderAmount = body.amount;
    if (!Array.isArray(body.items) || typeof orderAmount !== "number" || !Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new Error("A valid order is required.");
    }
    if (Math.round(orderAmount * 100) !== transaction.amount) throw new Error("The payment amount does not match this order.");

    const { data: order, error: orderError } = await adminClient.from("orders").insert({
      user_id: user.id,
      items: body.items,
      total_amount: orderAmount,
      status: "paid",
    }).select("id").single();
    if (orderError) throw orderError;

    const { error: paymentError } = await adminClient.from("paystack_payments").insert({
      reference: body.reference,
      user_id: user.id,
      payment_type: "order",
      order_id: order.id,
      amount: transaction.amount,
      currency: transaction.currency,
    });
    if (paymentError) throw paymentError;
    return Response.json({ success: true, orderId: order.id }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify payment.";
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
