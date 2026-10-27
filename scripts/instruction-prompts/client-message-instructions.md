## field.subject
The email subject line, or null for every channel that has no subject

## field.message
The complete message text, ready to paste, and nothing else

## subject-rule.with-subject
This channel has a subject line. Write one of at most {{max}} characters that says what the message is about.

## subject-rule.no-subject
This channel has no subject line, so subject must be null.

## label.format
The format this client's messages follow

## label.samples
Earlier messages to this client, for the shape only

## label.update
What to tell them this time

## sample-heading
Sample {{number}}:

## rewrite
Rewrite your draft message below. {{problems}} Keep everything else exactly as it is: the same facts, the same order, the same format and plain text.

<draft_message>
{{draft}}
</draft_message>

## problem.names
It uses the client's name ({{names}}). Take every part of their name out, including in the greeting, and greet them without a name.

## problem.too-long
It is {{length}} characters, but it should be at most {{max}} for this channel. Keep every point of the update and cut the wording back.
