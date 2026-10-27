## empty.default
Not provided.

## empty.sender-profile
Not provided. You know nothing about the sender. Don't write anything about their work, role, background, experience, skills, interests, services or offer, and don't claim any similarity or shared interest with the recipient.

## guard.rewrite
Your draft below says things about me (the sender), but you know nothing about me. Rewrite it so it contains no statement about my work, role, background, experience, skills, interests, services or offer, and no claimed similarity or shared interest. Keep the personalization about them, the tune's intent and every output field.

<draft>
{{draft}}
</draft>

## humanize.label
Texts to humanize

## humanize.retry
Your previous rewrite of these drafts broke a rule: {{problems}}. Rewrite them again and fix that, keeping every number, link, hashtag and @mention exactly as the draft has it and staying within each draft's limits.

## humanize.field.id
The draft's id, copied exactly

## humanize.field.text
The humanized text only

## humanize.field.texts
One entry per draft, in the same order

## humanize.problem.empty
{{id}}: empty

## humanize.problem.too-long
{{id}}: {{length}} characters, over the {{max}}-character limit

## humanize.problem.one-line
{{id}}: must be one line

## humanize.problem.markup
{{id}}: contains prompt markup

## humanize.problem.placeholder
{{id}}: contains a placeholder

## humanize.problem.sender-claim
{{id}}: adds a claim about the user

## humanize.problem.ai-words
{{id}}: uses AI-sounding words ({{words}}); use plain everyday words

## humanize.problem.dropped
{{id}}: dropped {{what}} {{tokens}}

## humanize.problem.added
{{id}}: added {{what}} {{tokens}}

## humanize.token.links
links

## humanize.token.hashtags
hashtags

## humanize.token.mentions
mentions

## humanize.token.numbers
numbers

## sender-context.about-me
About me (written by the user):
{{profile}}

## research.cover-angles
Cover each of these angles:
{{lenses}}

## research.pass-heading
### Search pass {{number}}

## pasted.left-out
[The rest of this pasted text was left out so the request fits.]

## conversation.field.user-name
Name of the user (the person you work for) as shown in the conversation, e.g. as the sender of their messages or as the name the other person greets. Null if not shown

## conversation.field.other-person-name
First name of the other person, never the user: the sender of the other person's messages, or from the profile. Null if unknown

## conversation.field.sender-name
The sender's name exactly as shown on this message (e.g. its header line), or null if not shown

## conversation.field.gist
A few words on what this message says or asks

## conversation.field.timeline
Every message in the conversation in chronological order, oldest first, one entry per message
