import { useState, useEffect } from "react";
import {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
} from "@/components/ui/expandable-chat";
import { Chat, ChatMessage as ChatMessageType } from "@/components/ui/chat";
import { MessageCircle } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import axios from "axios";

// Disable axios credentials to avoid CORS preflight
axios.defaults.withCredentials = false;

export function ChatWidget() {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: 1,
      content: "Hello! How can I help you today?",
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionUuid, setSessionUuid] = useState("");
  
  // Generate UUID once when component mounts
  useEffect(() => {
    const uuid = uuidv4();
    setSessionUuid(uuid);
    console.log("Generated UUID:", uuid);
    
    // Initial greeting - fetch bot introduction
    const url = `https://welcome-terminally-cattle.ngrok-free.app/webhook-test/d4dcf944-8fcc-404c-8a40-139f3ee77fc6?uuid=${uuid}&query=introduction`;
    
    console.log("Making GET request to:", url);
    
    // Configure request with proper headers to bypass ngrok protection
    axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      }
    })
    .then((response) => {
      console.log("Webhook response:", response.data);
      
      // Add bot response from API if successful
      if (Array.isArray(response.data) && response.data.length > 0) {
        const botResponse: ChatMessageType = {
          id: Date.now(),
          content: response.data[0].message || "I am the Garage Manager Bot.",
          role: "assistant",
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, botResponse]);
      }
    })
    .catch((error) => {
      console.error("Webhook error:", error);
    });
  }, []);

  const handleSendMessage = (content: string) => {
    if (!content.trim()) return;
    
    // Add user message
    const userMessage: ChatMessageType = {
      id: Date.now(),
      content,
      role: "user",
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    // Use the user's message as the query parameter
    const encodedQuery = encodeURIComponent(content);
    const url = `https://welcome-terminally-cattle.ngrok-free.app/webhook-test/d4dcf944-8fcc-404c-8a40-139f3ee77fc6?uuid=${sessionUuid}&query=${encodedQuery}`;
    
    console.log("Sending query to:", url);
    
    // Make the actual API call with the user's message
    (axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      }
    }) as Promise<any>)
    .then((response) => {
      console.log("Bot response:", response.data);
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        const botResponse: ChatMessageType = {
          id: Date.now() + 1,
          content: response.data[0].message || "I couldn't process your request.",
          role: "assistant",
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, botResponse]);
      } else {
        // Fallback response if data format is unexpected
        const fallbackResponse: ChatMessageType = {
          id: Date.now() + 1,
          content: "I received your message but couldn't generate a proper response.",
          role: "assistant",
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, fallbackResponse]);
      }
    })
    .catch((error) => {
      console.error("API error:", error);
      
      // Error response
      const errorResponse: ChatMessageType = {
        id: Date.now() + 1,
        content: "Sorry, I encountered an error while processing your request.",
        role: "assistant",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponse]);
    })
    .finally(() => {
      setIsLoading(false);
    });
  };

  return (
    <ExpandableChat position="bottom-right" size="md" icon={<MessageCircle className="h-6 w-6" />}>
      <ExpandableChatHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h3 className="font-medium">Garage Manager</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          Ask about vehicles, services, or parts
        </div>
      </ExpandableChatHeader>
      <ExpandableChatBody>
        <Chat
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          className="h-full"
        />
      </ExpandableChatBody>
    </ExpandableChat>
  );
}