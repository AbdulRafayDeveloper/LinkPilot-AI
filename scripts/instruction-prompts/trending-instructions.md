## research.request
<research_brief>
{{brief}}
</research_brief>

Search the web now and reply only with the research report format from your instructions.

## format.contrarian
Take the opposite side of how people are reacting to this news, and stay honest about it. Line 1 states the stand. Then 2 or 3 short paragraphs give the reasons, each with a concrete detail from the research. Then one paragraph says what you would do instead.

## format.story
Tell the development as a short story with a turn. First the situation before it. Then what happened, in 2 or 3 short paragraphs of 1 or 2 lines each. Then the moment it changes something for builders. Then the lesson in one line. Never invent the user's own experience, clients or results.

## format.playbook
Turn the development into steps the reader can act on this week. One short paragraph of setup, then 4 to 6 numbered steps, each on its own line and one sentence long. Then one line on what changes if they do it.

## format.numbers
Build the post around one real number from the research, and never invent or round one. Open with the number and what it replaces. Then a short before and after comparison on separate lines. Then 2 short paragraphs on what it changes for cost, time or risk.

## format.myth
Correct what people assume about this development. One line naming the belief. Then 3 short blocks, each a belief on one line and what the research actually shows on the next. Then one paragraph on what that means for people building right now.

## format.prediction
Say where this goes next and own the call. One line with the prediction and a rough timeframe. Then the signal behind it from the research, in 2 short paragraphs. Then one paragraph on what to do now to be ready, and admit what would prove you wrong.

## synthesis.format-line
{{number}}. {{id}} ({{label}}). {{structure}}

## synthesis.field.reference-url
Copied exactly from the verified source URL list

## synthesis.field.reference-source
Publisher or site name

## synthesis.field.candidates-evaluated
Number of distinct candidate developments evaluated before ranking

## synthesis.field.shortfall-reason
Why fewer topics than requested qualified, or null when the full set qualified

## synthesis.field.rank
1 is the strongest topic

## synthesis.field.event-date
YYYY-MM-DD as stated in the research, or null

## synthesis.field.linkedin-angle
What people on LinkedIn are actually saying or arguing about this, from the research

## synthesis.field.discussion-basis
Research signals behind the discussion assessment, without invented metrics

## synthesis.field.post-format
The assigned post format for this rank; every topic uses a different one

## synthesis.field.hook-style
The hook technique for this topic's post, e.g. "Contrarian take". Techniques must differ across topics.

## synthesis.field.post-hook
Scroll-stopping first line of the post, at most 12 words, following hook_style

## synthesis.field.post-body
The body under the hook, in the assigned format, with blank lines between short paragraphs. Long enough that the whole post reaches 1200 to 2000 characters. No links, no hashtags

## synthesis.field.post-cta
The closing line that asks for replies, one sentence, usually a question. No links, no hashtags

## expand.system
You rewrite one LinkedIn post that came out too thin to travel.

Rewrite its body to 250 to 320 words, so the finished post lands between {{min}} and {{max}} characters. Most drafts are half that, so this is the main job.

Rules
- Add real substance, not padding. Use the detail in the research report, so what changed, what it costs, who it affects, what breaks and what to do about it.
- Give every block of the post's format its own 2 or 3 lines. That is where the missing length comes from.
- Never add a fact, a number, a date, a company or a result the research report does not state. Never invent the writer's own experience, clients or projects.
- Keep the shape of the post's own format.
- Short paragraphs of 1 or 2 lines with a blank line between them.
- The closing line asks one question that names the specific choice in this post, so a reader can answer it from their own work. Never end with what do you think, thoughts, do you agree, how do you see this, or what tools do you use.
- No links, no hashtags, and no source lines anywhere in the post.
- Never name LinkedIn in the post. The reader is already there.
- The body never ends on a question. The closing line is the only question in the post.

HUMAN STYLE (STRICT, NEVER BREAK THIS)
- Never use an em dash, an en dash, a colon or a semicolon. End the sentence and start a new one instead.
- Never use AI-sounding words such as seamless, robust, leverage, utilize, delve, elevate, unlock, empower, streamline, game-changer, cutting-edge, revolutionize, synergy, realm, tapestry or fast-paced.
- Write like a real person typing on LinkedIn. Simple words, short sentences, no corporate buzzwords.

## expand.request
<research_report>
{{research}}
</research_report>

<post format="{{format}}">

Format shape to follow. {{structure}}

Hook. {{hook}}

Body. {{body}}

Closing line. {{cta}}

</post>

What to fix.
{{jobs}}

## expand.job.wrong-format
This body was written in a different shape and now has to be a {{format}}. Rebuild it to that shape, keeping the same facts.

## expand.job.short
The body is only {{length}} characters long. Make it 250 to 320 words.

## expand.job.generic-ending
The closing line asks nothing specific. Replace it.

## expand.job.ai-words
Replace these AI-sounding words with plain ones. {{words}}.

## expand.job.cliches
Cut these stock phrases and say the specific thing instead. {{phrases}}.

## expand.job.linkedin
The post talks about LinkedIn itself. The reader is already there, so write about the development and what it means for their work instead, and never name the platform.

## expand.job.statement-hook
Another post in this set already opens on a question, so rewrite this hook as a statement that makes the same point.

## expand.job.taken-openers
Another post in this set already opens with the same word, so this hook has to start somewhere else. These opening words are taken and none of them may be the first word. {{openers}}. Start on a verb, a number, the specific product or company name, or the thing at stake. Keep the same meaning and stay at most {{max}} words.

## expand.job.keep-hook
Return the hook exactly as it is.

## expand.field.hook
The first line, at most {{max}} words. Return it unchanged unless you were asked to change it

## expand.field.body
The rewritten body, 250 to 320 words, keeping the same facts and the same format shape, with blank lines between short paragraphs. No links, no hashtags

## expand.field.cta
The closing line, one sentence naming the specific choice this post is about, so a reader can answer it from their own work. No links, no hashtags

## humanize.kind.hook
LinkedIn post hook, the first line people see before "see more"

## humanize.kind.body
LinkedIn post body in the "{{format}}" format

## humanize.kind.cta
closing line of a LinkedIn post that asks readers to reply

## humanize.rule.hook
at most {{max}} words; keep it bold, specific and scroll-stopping

## humanize.rule.body
keep this shape and roughly this length. {{structure}} Keep the blank lines between paragraphs. No links and no hashtags

## humanize.rule.cta
one sentence that invites a real answer, not a generic thoughts prompt. No links and no hashtags

## humanize.problem.hashtags
{{id}}: hashtags belong at the end of the post, not here

## humanize.problem.link
{{id}}: a link in the post costs it reach, so leave it out

## humanize.problem.hook-words
{{id}}: over {{max}} words

## humanize.problem.opener
{{id}}: another post already opens with "{{word}}", keep the first word you were given

## humanize.problem.statement
{{id}}: keep this hook a statement, the set already has its question

## humanize.problem.too-short
{{id}}: too short, keep roughly the draft's length
