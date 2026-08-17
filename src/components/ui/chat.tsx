import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChatInput } from "@/components/ui/chatInput"
import { Send } from "lucide-react"

export interface ChatMessage {
  id: string | number
  content: string
  role: "user" | "assistant" | "system"
  timestamp?: Date
  avatar?: string
  name?: string
}

interface ChatProps extends React.HTMLAttributes<HTMLDivElement> {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
}

const Chat = React.forwardRef<HTMLDivElement, ChatProps>(
  ({ className, messages, onSendMessage, isLoading = false, ...props }, ref) => {
    const [input, setInput] = React.useState("")
    const messagesEndRef = React.useRef<HTMLDivElement>(null)

    const handleSendMessage = () => {
      if (input.trim() && !isLoading) {
        onSendMessage(input)
        setInput("")
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    }

    React.useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    return (
      <div
        ref={ref}
        className={cn("flex h-full flex-col overflow-hidden", className)}
        {...props}
      >
        <ChatMessages className="flex-1 px-4 py-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              className="mb-4 last:mb-0"
            />
          ))}
          <div ref={messagesEndRef} />
        </ChatMessages>
        <div className="border-t p-4">
          <div className="flex items-center gap-2">
            <ChatInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }
)
Chat.displayName = "Chat"

interface ChatMessagesProps extends React.HTMLAttributes<HTMLDivElement> {}

const ChatMessages = React.forwardRef<HTMLDivElement, ChatMessagesProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col overflow-y-auto", className)}
      {...props}
    />
  )
)
ChatMessages.displayName = "ChatMessages"

interface ChatMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  message: ChatMessage
}

const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ className, message, ...props }, ref) => {
    const isUser = message.role === "user"

    return (
      <div
        ref={ref}
        className={cn(
          "flex w-max max-w-[80%] flex-col gap-2",
          isUser ? "ml-auto" : "mr-auto",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {!isUser && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.avatar} alt={message.name || "Assistant"} />
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              "rounded-lg px-4 py-2 text-sm",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {message.content}
          </div>
          {isUser && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.avatar} alt={message.name || "User"} />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          )}
        </div>
        {message.timestamp && (
          <div
            className={cn(
              "text-xs text-muted-foreground",
              isUser ? "text-right" : "text-left"
            )}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    )
  }
)
ChatMessage.displayName = "ChatMessage"

export { Chat, ChatMessages, ChatMessage }
