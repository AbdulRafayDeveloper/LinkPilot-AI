## label.about-me
About me

## label.their-profile
Their profile

## field.recipient-summary
Who the recipient is and what they focus on now, from their profile only

## field.key-detail
The single highest-signal profile detail the InMail builds on

## field.sender-link
The sender-recipient connection the InMail uses, taken from both profiles. Fill it whenever the InMail mentions the sender's work or a similarity; null only when it doesn't

## field.subject-hook
The concrete element the subject will name, taken from key_detail: e.g. a project or product name, a number, a post's topic or their company. Never a broad theme

## field.subject
The InMail subject line only. It includes subject_hook, uses sentence case and is written deliberately as a subject, not a shortened copy of the message

## field.message
The InMail body only, without the subject line

## draft
Subject: {{subject}}

{{message}}

## humanize.kind.subject
LinkedIn InMail subject line

## humanize.kind.message
LinkedIn InMail message body (without the subject)

## humanize.rule.voice
At most {{max}} words, so it can be said in under 50 seconds. Keep it spoken English, short sentences, no corporate words.

## humanize.problem.opening
Keep the opening exactly "Hi <first name>, {{sentence}}"

## humanize.problem.question
End the message with one open question, ending with a question mark

## problem.abcd
End the message with these four lines exactly as they are, nothing changed:
{{options}}

## problem.voice-note-long
The voice note is {{words}} words, over the {{max}}-word ceiling. Cut it to about {{target}} words, keeping the personalized observation and the question at the end.
