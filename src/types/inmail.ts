import type { InMailTuneId } from "@/constants/inmail"

export interface GeneratedInMail {
  subject: string
  message: string
  tune: InMailTuneId
  subjectCharacters: number
  messageCharacters: number
  subjectMaxCharacters: number
  messageMaxCharacters: number
  warning: string | null
  usedSenderProfile: boolean
  analysis: {
    keyDetail: string
    senderLink: string | null
  }
}
