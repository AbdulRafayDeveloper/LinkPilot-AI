## field.evidence
"stated" when the transcript says it outright, "inferred" when it clearly follows from what was said

## field.participant.name
The speaker name as the transcript gives it, or "Unnamed speaker 1" when they speak but are never named

## field.participant.role
What they do, only when the transcript says so, otherwise null

## field.participant.is-named
True when the transcript actually gives their name

## field.action.task
The task exactly as it was agreed, in one line

## field.action.owner
Who took it on, or null when the transcript does not say

## field.action.deadline
Only a date or timeframe that was actually said, otherwise null

## field.decision
The decision as it was settled, in one line

## field.chunk.purpose
Why the meeting is being held, but only when this part actually says so, otherwise null

## field.chunk.participants
Only people who actually speak or are addressed as being in this part; never someone merely talked about

## field.chunk.topics
What this part of the meeting was about, a few words each

## field.chunk.decisions
Decisions settled in this part; a suggestion nobody agreed to is not a decision

## field.chunk.action-items
Tasks anyone agreed to do in this part

## field.chunk.my-tasks
Tasks the user himself agreed to or was asked to do

## field.chunk.my-decisions
Decisions that involve the user or change his work

## field.chunk.client-requests
What the client asked the user for, in their own terms

## field.chunk.unknowns
Things this part raises but leaves open, such as a date nobody set

## field.synthesis.title
A 4 to 8 word name for this meeting, in plain words

## field.synthesis.purpose
Why the meeting happened, in one or two sentences, or null when the notes never say

## field.synthesis.topics
The main subjects of the whole meeting, most important first, in a few words each

## field.synthesis.minutes
3 to 4 lines summarising the meeting, ready to send the client as it is

## label.previous-context
The end of the previous part, for context only

## empty.previous-context
This is the start of the meeting.

## label.transcript-part
The part of the meeting to read

## label.people
Who was in this meeting, as the user themselves named them

## empty.people
Nobody has said who was in this meeting, so go only by what the transcript shows.

## label.calendar
What the user's own calendar says this meeting was. A name here may be given to a speaker the recording never names, as a participant marked inferred; never invent any other name

## calendar.scheduled-as
It was scheduled as "{{name}}".

## calendar.with
It was with {{person}}.

## calendar.planned-for
It was planned for {{date}}.

## label.notes-from-parts
Notes from the parts

## part-heading
Part {{number}}:

## fold.request
{{instructions}}

These are the notes already taken from consecutive parts of one meeting, in order. Merge them into one set of notes for this stretch of the meeting: keep every distinct fact, drop exact repeats, and never add anything that is not in the notes.

## label.merged-notes
Everything the parts of the meeting gave up, merged and in order

## title.keep
The meeting already has the name "{{title}}". Repeat it exactly as the title.

## title.write
Give the meeting a name of 4 to 8 words, taken from what it was actually about.

## chat.analysis.stale
The analysis was built from an earlier version of this transcript, so trust the transcript itself where they disagree.

## chat.analysis.current
The analysis is up to date with the transcript.

## chat.analysis.none
This meeting has not been analysed yet, so only the transcript is available.

## chat.pieces-heading
Pieces of this meeting, closest to the question first:

## chat.nothing-matches
Nothing in this meeting's notes matches the question.

## chat.question
<meeting_notes>
{{notes}}
</meeting_notes>

Question: {{question}}

Write your answer in English.

## chunk.part
{{label}} ({{number}} of {{total}})

## chunk.evidence
This is {{evidence}}.

## chunk.label.details
Meeting details

## chunk.details.meeting
Meeting: {{name}}

## chunk.details.purpose
Purpose: {{purpose}}

## chunk.details.status
Status: {{status}}

## chunk.details.held
Held: {{date}}

## chunk.label.purpose
Purpose of the meeting

## chunk.label.minutes
Minutes of meeting

## chunk.topics
Topics discussed:

## chunk.label.topics
Topics discussed

## chunk.people
Who was there ({{count}}):

## chunk.label.people
Who was there

## chunk.label.my-decision
Decision involving me {{number}}

## chunk.my-decision
Decision involving me: {{decision}}

## chunk.label.decision
Decision {{number}}

## chunk.decision
Decision made: {{decision}}

## chunk.label.my-task
My task {{number}}

## chunk.my-task
A task for me

## chunk.label.action
Action item {{number}}

## chunk.action
Action item

## chunk.task.agreed-by
Agreed by: {{owner}}

## chunk.task.by
By: {{deadline}}

## chunk.requests
What the client asked for:

## chunk.label.requests
What the client asked for

## chunk.unknowns
The meeting never answered these:

## chunk.label.unknowns
Left unanswered

## chunk.label.transcript
What was said
