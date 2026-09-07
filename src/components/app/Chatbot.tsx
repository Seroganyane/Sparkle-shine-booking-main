import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getPackage, PACKAGES, PackageId } from "@/lib/packages";
import { MessageSquare, Send, X, Mic, MicOff } from "lucide-react";

type Message = { from: "bot" | "user"; text: string };

const initialMessages: Message[] = [
  { from: "bot", text: "Hi there! I can help you book a car wash today. Just say 'book a wash' and I'll guide you." },
];

type FlowStage = "idle" | "awaiting_slot" | "awaiting_car_make" | "awaiting_car_model" | "awaiting_license_plate" | "awaiting_package" | "awaiting_payment";

type BookingDraft = {
  slot?: number;
  car_make?: string;
  car_model?: string;
  car_plate?: string;
  package?: PackageId;
};

export const Chatbot = ({ freeWashes, onBooked }: { freeWashes: number; onBooked: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<FlowStage>("idle");
  const [draft, setDraft] = useState<BookingDraft>({});
  const [availableSlots, setAvailableSlots] = useState<number[]>([]);
  const [listening, setListening] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const addMessage = (message: Message) => setMessages((prev) => [...prev, message]);

  const formatSlots = (slots: number[]) => slots.join(", ");

  const initSpeechRecognition = () => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        addMessage({ from: "user", text: transcript });
        await handleUserMessage(transcript);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event);
      setListening(false);
      addMessage({ from: "bot", text: "Voice recognition failed. Please try again or type your message." });
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setRecognitionSupported(Boolean(SpeechRecognition));
  }, []);

  const startListening = () => {
    if (!recognitionSupported) {
      addMessage({ from: "bot", text: "Voice booking is not supported in this browser." });
      return;
    }

    const recognition = initSpeechRecognition();
    if (!recognition) {
      addMessage({ from: "bot", text: "Voice booking is not supported in this browser." });
      return;
    }

    setListening(true);
    recognition.start();
    addMessage({ from: "bot", text: "Listening to your voice now. Please say your request clearly." });
  };

  const getAvailableSlots = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("slot_number,status")
      .in("status", ["pending", "confirmed", "in_queue", "in_progress"]);

    const rows = (data as Array<{ slot_number: number | null }> | null) || [];
    const occupied = new Set<number>(
      rows
        .map((row) => row.slot_number)
        .filter((slot): slot is number => typeof slot === "number")
    );
    const free = Array.from({ length: 10 }, (_, i) => i + 1).filter((slot) => !occupied.has(slot));
    setAvailableSlots(free);
    return free;
  };

  const getNextQueuePosition = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("queue_position")
      .in("status", ["confirmed", "in_queue", "in_progress"])
      .order("queue_position", { ascending: false })
      .limit(1);

    return (data?.[0]?.queue_position ?? 0) + 1;
  };

  const startBooking = async () => {
    if (!user) {
      addMessage({ from: "bot", text: "Please sign in first so I can book a wash for you." });
      setChatOpen(true);
      return;
    }
    const slots = await getAvailableSlots();
    if (slots.length === 0) {
      addMessage({ from: "bot", text: "Sorry, all slots are currently taken. Please come back soon." });
      return;
    }
    addMessage({ from: "bot", text: `Great! Available slots are ${formatSlots(slots)}. Which slot would you like to book?` });
    setStage("awaiting_slot");
  };

  const parseSlotNumber = (text: string) => {
    const match = text.match(/(\d+)/);
    if (!match) return null;
    const slot = Number(match[1]);
    return Number.isInteger(slot) && slot >= 1 && slot <= 10 ? slot : null;
  };

  const handleBookingCreation = async () => {
    if (!user || !draft.slot || !draft.car_make || !draft.car_model || !draft.car_plate || !draft.package) {
      addMessage({ from: "bot", text: "I need all booking details first. Please start again by saying 'book a wash'." });
      setStage("idle");
      setDraft({});
      return;
    }

    const currentPackages = PACKAGES.map((p) => p.id);
    const chosenPackage = currentPackages.includes(draft.package) ? draft.package : "premium" as PackageId;
    const price = getPackage(chosenPackage).price;
    const queue_position = await getNextQueuePosition();

    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      car_make: draft.car_make,
      car_model: draft.car_model,
      car_plate: draft.car_plate.toUpperCase(),
      package: chosenPackage,
      slot_number: draft.slot,
      scheduled_at: new Date().toISOString(),
      notes: null,
      amount: price,
      payment_status: "paid",
      status: "in_queue",
      queue_position,
    });

    if (error) {
      addMessage({ from: "bot", text: `Sorry, something went wrong while booking: ${error.message}` });
      setStage("idle");
      setDraft({});
      return;
    }

    addMessage({ from: "bot", text: `Payment successful! Your car is now booked for slot ${draft.slot}. You can bring your car in for a wash. Booking successfully created.` });
    onBooked();
    setDraft({});
    setStage("idle");
  };

  const isPaymentIntent = (text: string) => {
    return text.includes("payment") || text.includes("payments") || text.includes("paying") || text.includes("making payments");
  };

  const handleUserMessage = async (text: string) => {
    const normalized = text.trim().toLowerCase();
    addMessage({ from: "user", text });

    if (stage === "awaiting_slot") {
      const slot = parseSlotNumber(normalized);
      if (!slot) {
        addMessage({ from: "bot", text: "Please tell me a slot number, for example: slot 4." });
        return;
      }
      if (!availableSlots.includes(slot)) {
        addMessage({ from: "bot", text: `Slot ${slot} is already taken. Available slots are ${formatSlots(availableSlots)}.` });
        return;
      }
      setDraft((prev) => ({ ...prev, slot }));
      if (!draft.car_make) {
        addMessage({ from: "bot", text: `Perfect, slot ${slot} is available. What is your car make?` });
        setStage("awaiting_car_make");
      } else if (!draft.car_model) {
        addMessage({ from: "bot", text: `Perfect, slot ${slot} is available. What is your car model?` });
        setStage("awaiting_car_model");
      } else if (!draft.car_plate) {
        addMessage({ from: "bot", text: `Perfect, slot ${slot} is available. What is your license plate?` });
        setStage("awaiting_license_plate");
      } else {
        addMessage({ from: "bot", text: `Perfect, slot ${slot} is available. Which package would you like? Basic, Premium, or Deluxe?` });
        setStage("awaiting_package");
      }
      return;
    }

    if (stage === "awaiting_car_make") {
      setDraft((prev) => ({ ...prev, car_make: text.trim() }));
      addMessage({ from: "bot", text: "Great! What is your car model?" });
      setStage("awaiting_car_model");
      return;
    }

    if (stage === "awaiting_car_model") {
      setDraft((prev) => ({ ...prev, car_model: text.trim() }));
      addMessage({ from: "bot", text: "Nice. What is your license plate?" });
      setStage("awaiting_license_plate");
      return;
    }

    if (stage === "awaiting_license_plate") {
      setDraft((prev) => ({ ...prev, car_plate: text.trim() }));
      if (!draft.slot) {
        if (availableSlots.length === 0) {
          const slots = await getAvailableSlots();
          if (slots.length === 0) {
            addMessage({ from: "bot", text: "Sorry, all slots are currently taken. Please come back soon." });
            setStage("idle");
            setDraft({});
            return;
          }
        }
        addMessage({ from: "bot", text: `Thanks. I have your car details. Which slot would you like? Available slots are ${formatSlots(availableSlots)}.` });
        setStage("awaiting_slot");
      } else {
        addMessage({ from: "bot", text: "Which package would you like? Basic, Premium, or Deluxe?" });
        setStage("awaiting_package");
      }
      return;
    }

    if (stage === "awaiting_package") {
      const chosen = (text.trim().toLowerCase() as PackageId);
      const match = PACKAGES.find((pkg) => pkg.id === chosen || pkg.name.toLowerCase().includes(chosen));
      const selectedPackage = match ? match.id : ("premium" as PackageId);
      const price = getPackage(selectedPackage).price;
      setDraft((prev) => ({ ...prev, package: selectedPackage }));
      addMessage({ from: "bot", text: `Excellent, a ${getPackage(selectedPackage).name} will cost R ${price}. Type 'yes' to pay now and confirm your booking.` });
      setStage("awaiting_payment");
      return;
    }

    if (stage === "awaiting_payment") {
      if (normalized.includes("yes") || normalized.includes("pay") || normalized.includes("confirm")) {
        addMessage({ from: "bot", text: "Processing your payment now..." });
        await handleBookingCreation();
        return;
      }
      addMessage({ from: "bot", text: "Please reply 'yes' to complete the payment and finalize your booking." });
      return;
    }

    if (isPaymentIntent(normalized)) {
      if (!user) {
        addMessage({ from: "bot", text: "Please sign in first so I can collect your car details and complete payment." });
        return;
      }
      await getAvailableSlots();
      addMessage({ from: "bot", text: "Okay, to take payment I need your car details first. What is your car make?" });
      setStage("awaiting_car_make");
      return;
    }

    if (normalized.includes("book") || normalized.includes("wash") || normalized.includes("slot")) {
      await startBooking();
      return;
    }

    if (normalized.includes("help")) {
      addMessage({ from: "bot", text: "I can help you book a wash step-by-step: just say 'book a wash' or 'I'm making payments' and I will guide you." });
      return;
    }

    addMessage({ from: "bot", text: "I can help book your wash. Say 'book a wash' to begin or 'I'm making payments' to enter your car details for payment." });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;
    await handleUserMessage(input.trim());
    setInput("");
  };

  const openBooking = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    await startBooking();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {chatOpen && (
        <div className="w-[340px] rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">AquaLux Assistant</div>
              <div className="text-xs text-muted-foreground">Ask me to book your next wash.</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-full rounded-2xl p-3 ${message.from === "bot" ? "bg-secondary text-secondary-foreground" : "ml-auto bg-primary text-primary-foreground"}`}>
                <p className="text-sm">{message.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={openBooking} className="flex-1">
              Book a wash
            </Button>
            <Button size="sm" variant="outline" onClick={startListening} className="flex-1">
              {listening ? (
                <><MicOff className="mr-2 h-4 w-4" /> Stop</>
              ) : (
                <><Mic className="mr-2 h-4 w-4" /> Voice book</>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={() => addMessage({ from: "bot", text: "You can say 'book a wash' or tap the voice button to start booking with your voice." })}>
              Help
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button type="submit" size="sm" className="px-3">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="cursor-pointer" onClick={openBooking}>
              Book a wash
            </Badge>
            <Badge variant="secondary">Available slots</Badge>
            <Badge variant="secondary">My rewards</Badge>
          </div>
        </div>
      )}
      <Button onClick={() => setChatOpen((prev) => !prev)} className="rounded-full px-4 py-3 shadow-glow">
        <MessageSquare className="mr-2 h-4 w-4" /> Chat
      </Button>
    </div>
  );
};
