"use client"

import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Download, Eye, Image as ImageIcon, File } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export interface Message {
  id: string
  text: string | null
  type: 'text' | 'image' | 'file'
  incoming: boolean
  imageUrl?: string | null
  fileUrl?: string | null
  caption?: string | null
  timestamp: string
}

interface MessageBubbleProps {
  message: Message
  className?: string
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  const isIncoming = message.incoming
  const timestamp = new Date(message.timestamp)

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className="text-sm">
            {message.text || 'No content'}
          </div>
        )

      case 'image':
        return (
          <div className="space-y-2">
            {message.imageUrl ? (
              <Dialog>
                <DialogTrigger asChild>
                  <div className="cursor-pointer group relative">
                    <Image
                      src={message.imageUrl}
                      alt={`Message image${message.caption ? ': ' + message.caption : ''}`}
                      width={300}
                      height={200}
                      className="max-w-xs rounded-lg group-hover:opacity-90 transition-opacity object-contain"
                      style={{ maxHeight: '200px' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        target.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                    <div className="hidden flex items-center justify-center bg-muted rounded-lg p-4 min-h-[100px]">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2" aria-hidden="true" />
                        <p className="text-sm">Image unavailable</p>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/50 rounded-full p-2">
                        <Eye className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Image Message</DialogTitle>
                  </DialogHeader>
                  <div className="flex justify-center">
                    <Image
                      src={message.imageUrl}
                      alt={`Full size message image${message.caption ? ': ' + message.caption : ''}`}
                      width={800}
                      height={600}
                      className="max-w-full max-h-[70vh] object-contain"
                    />
                  </div>
                  {message.caption && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {message.caption}
                    </p>
                  )}
                </DialogContent>
              </Dialog>
            ) : (
              <div className="flex items-center justify-center bg-muted rounded-lg p-4 min-h-[100px]">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm">Image unavailable</p>
                </div>
              </div>
            )}
            {message.caption && (
              <p className="text-xs text-muted-foreground">
                {message.caption}
              </p>
            )}
          </div>
        )

      case 'file':
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-3 bg-muted/50 rounded-lg p-3 max-w-xs">
              <File className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {message.caption || 'File attachment'}
                </p>
                {message.fileUrl && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      if (message.fileUrl) {
                        window.open(message.fileUrl, '_blank')
                      }
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                )}
              </div>
            </div>
            {message.text && (
              <p className="text-sm">{message.text}</p>
            )}
          </div>
        )

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Unsupported message type: {message.type}
          </div>
        )
    }
  }

  return (
    <div
      className={cn(
        "flex w-full",
        isIncoming ? "justify-start" : "justify-end",
        className
      )}
    >
      <div className="flex flex-col space-y-1 max-w-[85%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2 shadow-sm",
            isIncoming
              ? "bg-muted text-foreground rounded-bl-sm"
              : "bg-primary text-primary-foreground rounded-br-sm"
          )}
        >
          {renderMessageContent()}
        </div>
        <div
          className={cn(
            "text-xs text-muted-foreground px-2",
            isIncoming ? "text-left" : "text-right"
          )}
        >
          {format(timestamp, 'MMM d, h:mm a')}
        </div>
      </div>
    </div>
  )
}