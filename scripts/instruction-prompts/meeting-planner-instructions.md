## field.evidence
"stated" when the supplied information says it outright, "inferred" when it only follows from it

## field.observation
One specific observation about the person, in one sentence

## field.situation
"they_asked_for_a_project" when the conversation shows they came to me with a specific project or need, "you_reached_out" when I started the conversation to offer working together and they have not named a project, "unclear" when the supplied information does not show which

## field.what-it-is-about
One or two sentences: the specific project they brought, in their words, or the collaboration I proposed and what they have said back

## field.who-they-are
Who this person is, from the supplied information only. Say plainly what is unknown

## field.background
Their professional background as the supplied information gives it

## field.interests
What they pay attention to professionally

## field.needs
Problems, goals or gaps this meeting could help with, each tied to something supplied

## field.how-you-can-help
Where the user's own stated skills and past work meet those needs. Never claim work the user's profile does not state

## field.before-you-join
What the user should keep in mind walking into this meeting

## field.open-questions
What is genuinely unknown about this person or their situation, to ask instead of assuming

## field.topic
A topic worth spending time on in this meeting

## field.why-it-matters
Why it matters to this person, from the supplied information

## field.topics
The topics this particular meeting should cover, most relevant first: the details of their project when they brought one, or where my work fits their business when I reached out

## field.project
One of my own projects or products, named exactly as my profile names it

## field.why-it-will-land
Why this person in particular will care about it, tied to their project, need or interest

## field.projects
2 to 4 of my own projects to have open and show them, most convincing first. Only work my profile states; empty when my profile has none

## field.your-intro
My introduction, said near the start, in first person: who I am and what I build, in my profile's words, shaped to what this person cares about. 3 to 5 spoken sentences

## field.stage-title
The stage name, e.g. Opening and rapport

## field.stage-goal
What this stage is for, in one line

## field.step-kind
"say": words I say aloud, statements only. "ask": exactly one question I ask. "listen": I stop talking and let them speak; the text says what to listen for. "show_project": I open one of my projects and show it. "note": a short reminder for me, not said aloud

## field.step-text
say: the exact first-person words, 1 to 4 sentences. ask: the one question. listen: what to listen for and how to react. show_project: the words I say while showing it. note: the reminder

## field.step-project
show_project only: the project, named exactly as in projects_to_show; empty for every other kind

## field.step-minutes
show_project only: roughly how many minutes to spend showing it, 2 to 10; 0 for every other kind

## field.step-features
show_project only: 2 to 5 features or screens of that project to show, the ones this person will care about most; empty for every other kind

## field.steps
What happens in this stage, in order: usually say, then ask and listen in turn, and a closing say that leads into the next stage

## field.move-on-when
What I need to have heard or agreed before this stage is done, in one line

## field.conversation
The meeting from hello to goodbye, in the order it happens

## field.signals
What in their answers would show there is a real project here, and what would show there isn't

## field.raise-scope
How to move to scope, budget or timing only once the fit is clear

## field.next-step
The next step to suggest at the end, sized to how the meeting went

## field.cautions
Things the user must not claim or assume in this meeting because no source supports them

## label.profile
Profile information about the person

## label.conversation
The conversation with them so far

## label.notes
Anything else that matters for this meeting

## label.about-me
About me, the person taking this meeting

## empty.about-me
Not provided. You know nothing about the user's background, services or results. Do not put any claim about their work, experience or past results into the plan; keep the meeting on the other person and on questions.

## label.chosen-projects
Projects I have already chosen to show in this meeting, in order

## empty.chosen-projects
None chosen yet. Choose them from my profile.

## when
{{date}} at {{time}}

## person-unknown
not given

## rewrite
Write the preparation again, keeping everything else, and fix exactly these problems:
{{problems}}

## problem.invented-figures
It states figures that neither the information about them nor my own profile contains: {{figures}}. Those are invented; never put a number in my mouth that my profile does not state.

## problem.chosen-not-shown
the conversation never shows the projects I chose ({{projects}}); give each a show_project step where it fits best, named exactly that way

## problem.question-in-say
stage "{{stage}}" has a question inside a say step; make each question its own ask step

## problem.no-ask
stage "{{stage}}" has no ask step; give it 1 to 3

## problem.no-listen
stage "{{stage}}" asks questions but has no listen step saying when to stop and hear them out

## problem.no-closing-say
stage "{{stage}}" doesn't end with a say step that leads into the next stage

## problem.unknown-project
stage "{{stage}}" shows "{{project}}", which is not a project named in my profile

## problem.invented-features
the features listed for "{{project}}" ({{features}}) are not what my profile describes for that project; list only features my profile gives it, and describe it in the text only by those

## problem.no-features
the show_project step for "{{project}}" in stage "{{stage}}" names no features to show

## problem.no-show-step
the conversation never has a show_project step; add one where showing my most relevant project fits best

## problem.mirrored-specialty
"{{phrase}}" claims a specialty my profile never names; connect a real project of mine instead

## chat.person-unknown
the person

## chat.pieces-heading
Pieces of this meeting, closest to the question first:

## chat.nothing-matches
Nothing saved on this meeting matches the question.

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

## chunk.details.person
Person: {{person}}

## chunk.details.when
When: {{date}} at {{time}}

## chunk.details.status
Status: {{status}}

## chunk.details.why
Why the meeting exists: {{about}} ({{situation}})

## chunk.label.profile
Their profile

## chunk.label.history
Conversation so far

## chunk.label.notes
Your notes

## chunk.lead.who
Who they are: {{value}}

## chunk.lead.background
Background: {{value}}

## chunk.lead.interests
What interests them:

## chunk.lead.needs
What they need, and where the opportunity is:

## chunk.lead.help
How you can help:

## chunk.lead.before
Before you join the call:

## chunk.lead.unknown
Still unknown, so ask:

## chunk.label.lead
Read of the person

## chunk.label.intro
How to introduce yourself

## chunk.label.topic
Topic {{number}}. {{topic}}

## chunk.topic
Topic to cover: {{topic}}
Why it matters: {{why}}

## chunk.step.project
project: {{project}}

## chunk.step.minutes
about {{minutes}} minutes

## chunk.step.features
show {{features}}

## chunk.stage.heading
Stage {{number}} of the conversation: {{title}}

## chunk.stage.goal
Goal: {{goal}}

## chunk.stage.move-on
Move on when: {{value}}

## chunk.label.stage
Stage {{number}}. {{title}}

## chunk.label.project
Project to show: {{project}}

## chunk.project
Project to show them: {{project}}
Why it will land: {{why}}

## chunk.project.link
Link: {{link}}

## chunk.deal.signals
Signals to listen for:

## chunk.deal.scope
How to raise scope: {{value}}

## chunk.deal.next
The natural next step: {{value}}

## chunk.label.deal
Deal path

## chunk.cautions
Do not claim any of this, because nothing supports it:

## chunk.label.cautions
Cautions
