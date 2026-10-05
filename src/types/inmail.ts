import type { InMailTuneId } from "@/constants/inmail"
import type { WithAiSource } from "./ai"

export interface GeneratedInMail extends WithAiSource {
  subject: string
  message: string
  tune: InMailTuneId
  subjectCharacters: number
  messageCharacters: number
  subjectMaxCharacters: number
  messageMaxCharacters: number
  // A voice note is judged in words: how many it is, and about how long it takes to say
  wordCount?: number
  speakingSeconds?: number
  warning: string | null
  usedSenderProfile: boolean
  analysis: {
    keyDetail: string
    senderLink: string | null
  }
}
