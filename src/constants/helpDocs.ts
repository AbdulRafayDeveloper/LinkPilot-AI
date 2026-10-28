import type { HelpDoc, HelpTopic } from "@/types/help"
import { ACCOUNT_SETTINGS_PATH } from "./auth"

/**
 * Help & Documentation: what every module is for, how it is used, and what is worth knowing before
 * using it. One article per tool, keyed by the tool's own id in `APP_TOOLS`, so the page can build
 * its topics from the app's one navigation source rather than from a second list of modules
 * (`lib/helpTopics.ts`). A tool with no article here is still listed, as something to write.
 *
 * It is written for the person using the app, not for whoever builds it: short sentences, the
 * steps in the order they are taken, and no mention of a route, a collection or a provider's name
 * unless the reader sees it on screen. The implementation notes live in CLAUDE.md.
 */

export const HELP_PATH = "/help"

export const HELP_MESSAGES = {
  title: "Help & Documentation",
  subtitle: "Every part of LinkPilot AI, what it is for and how to use it.",
  lede: "Short, plain articles for each module: what it does, the steps to use it, and what is worth knowing before you start.",
  startHeading: "Start here",
  topicsHeading: "Topics",
  allTopics: "All topics",
  openApp: "Open the app",
  openTool: "Open",
  stepsHeading: "How to use it",
  notesHeading: "Worth knowing",
  adminOnly: "Admins only",
  todo: "This article is still to be written.",
  nothingToRead: "There is nothing to document here yet.",
  // The page is read without signing in, so it says what it is rather than whose account it is
  isPublic: "Anyone with this link can read these pages. Nothing here is your own data, and nothing on this page needs an account.",
  search: "Search the documentation",
  searchShort: "Search",
  clearSearch: "Clear",
  noMatch: "Nothing matches that. Try a tool's name, or a word like image, voice, meeting or prompt.",
  matches: (found: number) => `${found} ${found === 1 ? "article" : "articles"}`,
  countOf: (tools: number) => `${tools} ${tools === 1 ? "module" : "modules"}`,
  backToTop: "Back to top",
  footer: "These pages describe the app as it works today. Open a tool to try what you have just read.",
} as const

/** Shown for a tool nobody has written an article for yet, so the page never renders an empty section. */
export const MISSING_HELP_DOC: HelpDoc = {
  summary: "[TODO: fill in detailed docs]",
  steps: ["Open the tool from the sidebar to see what it asks for."],
  todo: true,
}

/** The three articles the page opens with: the app itself, the reader's own account, the shared prompts. */
export const HELP_START_TOPICS: HelpTopic[] = [
  {
    id: "how-it-works",
    title: "How LinkPilot works",
    doc: {
      summary: "One workspace for the LinkedIn copy you post, the clients you work for and the day's own work.",
      steps: [
        "Sign in once. The sidebar's left rail holds the four areas (Workspace, Client Work, LinkedIn Tools and, for an admin, Administration); clicking an area lists its tools beside it.",
        "Search every tool from the box under the area's name, or press Ctrl/Cmd+K anywhere to jump to a tool by name.",
        "A tool with two pages (a create page and a View All page) opens as a dropdown in the sidebar; the create page is the tool itself.",
        "Everything you type or generate stays where it is when you move to another tool and come back, and each browser tab keeps its own copy.",
      ],
      notes: [
        "Nothing is posted to LinkedIn for you. The tools write the text and the image; you paste or upload them yourself.",
        "Every result can be edited in place before you copy it, and Ctrl/Cmd+B makes the selection bold in LinkedIn's own style.",
        "Each tool's Reset button (the arrow in the tool's header) clears what you pasted and what was written, and keeps the tone or style you chose.",
        "Where an AI wrote something, the result says which model it came from, so you can tell a fallback from the usual one.",
      ],
    },
  },
  {
    id: "account-settings",
    title: "Account Settings",
    href: ACCOUNT_SETTINGS_PATH,
    doc: {
      summary: "Your own name, profile photo and password, reached from the account menu in the header.",
      steps: [
        "Open the account menu at the top right and choose Account settings.",
        "Change your name and press Save name; it shows in the header straight away.",
        "Upload a photo (PNG, JPG or WEBP, up to 4 MB) to replace your initials, or remove it to go back to them.",
        "To change your password, type the one you sign in with now, then the new one twice, and press Change password.",
      ],
      notes: [
        "Changing your password signs out every other browser signed in to this account, and keeps you signed in where you made the change.",
        "A sign-in lasts a year, and the year starts again every time you use the app, so you are not signed out from one day to the next.",
        "Your email and your role are shown there but are an admin's to change.",
      ],
    },
  },
  {
    id: "global-prompts",
    title: "My AI Profile",
    href: "/global-prompts",
    doc: {
      summary: "Everything about you that the tools use to write as you: your profile, your experience, projects, skills, services, education, certificates and reviews.",
      steps: [
        "Open My AI Profile at the bottom of the sidebar.",
        "On the Profile Info tab, press Update Prompt. Profile Info holds your real experience, projects and numbers. Tools quote from it and never invent anything beyond it.",
        "On the Projects tab, press Add project and fill in the name, a summary, what stands out, the Upwork jobs it matches, what to emphasize for each kind of client need and its search keywords. For now projects are kept in your browser only and no tool reads them yet.",
        "Experience, Skills, Services, Education, Certifications and Reviews are coming soon. Their tabs are already there and say what each will keep.",
        "Humanization is the last step of every LinkedIn tool. Only an admin can change it, from Administration, then Global AI Prompts.",
        "Save, and the next thing you generate uses the new wording.",
      ],
      notes: [
        "Your Profile Info is yours alone: each account keeps its own, only the results you generate use it, and nobody else, an admin included, sees or changes it.",
        "Your background also comes from About Me, which an admin edits under Administration → Global AI Prompts, since every account shares it.",
        "Leave the facts honest: the tools check what they write against these words and rewrite anything they cannot support.",
        "Everything you save is also saved for search, so the tools can later pick the parts of your profile that fit each job. If that step fails, your entry is still saved, and the reason is shown with a Try again.",
      ],
    },
  },
]

/**
 * One article per tool, keyed by the tool's id. The ids are the sidebar's own
 * (`APP_TOOLS`), and `tests/helpDocs.test.mjs` fails when a tool has no entry here.
 */
export const HELP_DOCS: Record<string, HelpDoc> = {
  // ---------------------------------------------------------------- Workspace
  "prompt-creator": {
    summary: "Turns a task you describe, typed or spoken in any language, into one ready-to-paste English prompt.",
    steps: [
      "Describe the task in your own words, or press the microphone and say it.",
      "Press Read it in English to check the description came through as you meant it, and write the prompt from that version if it reads better.",
      "Pick who the prompt is for: a coding agent (Cursor, Claude, Antigravity) or ChatGPT / Gemini Search, the two targets the page offers.",
      "Pick the client project it belongs to, so the project's standing instructions are added to the end of the prompt.",
      "Press Create Prompt, then copy it. Rename it or edit the text in place and it saves itself.",
    ],
    notes: [
      "View All Prompts keeps everything written: file prompts in folders, say which prompts another one waits for, and mark one applied once you have run it.",
      "A prompt you wrote somewhere else can be added by hand from that page and behaves like any other.",
      "Tick 'use this prompt once' to have nothing saved at all; copy it before you leave the page.",
    ],
  },
  "daily-tasks": {
    summary: "A checklist per day: write several tasks in one go, tick them off, and keep the last seven days on screen.",
    steps: [
      "Press Add task, type one task per line (Enter opens the next line, Ctrl/Cmd+Enter saves) and choose the day they belong to.",
      "Give a task a priority, say whether it is yours or an employee's, mark it blocked, or make it repeat daily, weekly or monthly.",
      "Tick a task to finish it; it moves to the end of its day's list.",
      "Drag a task anywhere in its day or into another day, several at once by picking them first.",
      "Use the three-dot menu on a row for its details, a subtask, a copy of its line or to delete it.",
    ],
    notes: [
      "A task can carry a description, images and subtasks three levels deep, and Write with AI drafts the description from the task's own line.",
      "Overdue tasks come to today from the button in the header, which also brings back a repeating task that is due again.",
      "Narrow the list by priority, by who does it, by blocked or by done, from the row beside Last 7 Days; a filter stays on until you clear it.",
      "Nothing is deleted because it got old: the week-old cleanup is a button, and it always confirms first.",
    ],
  },
  "activity-logs": {
    summary: "Everything your account has done in the app, newest first: what you created, changed, deleted or generated, and every sign-in.",
    steps: [
      "Open Activity Logs from Workspace to see your own activities, 50 to a page.",
      "Search by what was done, the tool, the address or the browser, and narrow by tool, action, outcome or dates.",
      "Tick activities and press Delete, or delete everything the filters cover, to take them off your list.",
    ],
    notes: [
      "Only your own activities are ever shown here, never another account's.",
      "Opening a page or a list is not an activity; creating, editing, deleting, generating, uploading and moving are.",
      "The same action repeated within a minute, such as an editor saving itself, is one line with a count beside it.",
      "Deleting an activity removes it from your list. It is kept for the administrators, who see it marked as deleted.",
    ],
  },
  "message-rewriter": {
    summary: "Turns a message you type or speak, in any language, into one short, clear English message you can send.",
    steps: [
      "Type or paste the message, or press the microphone and say it.",
      "Press Rewrite, and read the English version it answers with.",
      "Edit it in place if a word is not yours, then copy it.",
    ],
    notes: [
      "It only says what you said: nothing is added, and the rewrite is never longer than the original unless the original was a note of a few words.",
      "The result says which language it was read from when that was not English.",
      "Every rewrite is kept on View All Rewrites, searchable by language and by whether you typed or spoke it.",
    ],
  },
  "important-content": {
    summary: "Named text worth finding again: logins, links, procedures, snippets, each under a type you make up.",
    steps: [
      "Press Add New Content, give it a name and a type (any word you like), and write the description.",
      "Write it as a page, not as marks: bold, headings, lists, tables, code blocks and images all work, and a paste keeps its shape.",
      "Save, then find it again by name, by type or by folder; both those filters are searched rather than scrolled.",
      "Use View details to read one entry on the whole screen, with A− and A+ for the reading size.",
    ],
    notes: [
      "An edit saves itself a moment after you stop typing, and says when it was saved.",
      "Entries are filed in this module's own folders; deleting a folder keeps its entries and puts them back under No folder.",
      "An entry can hold images, and a description can run to a million characters.",
    ],
  },
  "quick-notes": {
    summary: "Somewhere to drop text you will reuse shortly, newest first, with no naming or filing needed.",
    steps: [
      "Paste or write the note, give it a name if you want one, and press Save (or Ctrl/Cmd+Enter).",
      "Or press Speak instead beside the editor and say the note in any language. Press Stop when you are done: what you said is written in clear English and added to the note, ready to read, change and save.",
      "Copy a note with its copy button, which always takes the whole note.",
      "Delete a note with one click; only Clear All asks first.",
    ],
    notes: [
      "A note can be formatted and can hold pasted images.",
      "A spoken note can run up to six minutes. Show what you said puts the English beside your own words, and if the English cannot be written, your words are kept with Try again and a way to add them as you said them.",
      "The pencil opens a note for editing and saves itself as you type.",
      "A note worth keeping moves into Important Content with the key icon, which asks for the type and folder it should live under.",
    ],
  },
  employees: {
    summary: "Your team, each with a daily plan they tick off themselves through a private link.",
    steps: [
      "Add an employee (name, city, role, date of joining) and drag the team into the order you want.",
      "Write their daily plan once: it repeats every day until you change it, and the editor saves itself.",
      "Press New link to get their own page, and send it to them. It shows their name, role and today's tasks and nothing else.",
      "Watch the history below the plan to see which day each task was finished on.",
    ],
    notes: [
      "The employee's day only moves on when they press Start new day, so someone working at 1am keeps the same list.",
      "They can reorder their own list, write why a task was not finished, and cancel a day started by mistake.",
      "Turn off takes every link away; New link replaces the one you sent before.",
    ],
  },
  "important-files": {
    summary: "Your own drive: images, PDFs, Word files, text, video, audio and archives, in folders you make and nest.",
    steps: [
      "Press Upload file, choose the file, and give it a name of your own plus an optional description.",
      "Make folders in the tree on the left and drag files between them, or use Move for the same thing by keyboard.",
      "Search by name, filter by type, then preview or download what you find.",
    ],
    notes: [
      "Limits per kind: video and archives 500 MB, audio 200 MB, PDF and Word 100 MB, images and text 25 MB.",
      "Nothing is public: every preview and download is a link that stops working after a few minutes.",
      "Deleting a folder keeps its files and puts them where the folder was.",
    ],
  },

  // ---------------------------------------------------------------- LinkedIn Tools
  "comment-writer": {
    summary: "Writes a comment on someone else's post, from the post's text or a screenshot of it, in eight tunes.",
    steps: [
      "Paste the post, or upload a screenshot of it.",
      "Pick the tune: Thoughtful to begin with, Value Add to add something, Supportive, Relatable and the rest.",
      "Press Write, and watch the stages as it reads the post and researches anything it needs.",
      "Edit the comment if you want to, then paste it into LinkedIn.",
    ],
    notes: [
      "The finished comment is copied for you the moment it is written, so you can paste it while still on LinkedIn.",
      "The count under the heading says how many comments you have written today and in all.",
      "Profile Scheduler, the tool's third page, keeps the people worth commenting on and the days you look at each.",
    ],
  },
  "post-comment-replies": {
    summary: "Writes your reply to one comment, on your own post or on somebody else's, in seven styles.",
    steps: [
      "Paste the post and the comments under it, or a screenshot of the thread.",
      "Say whose post it is, then pick a style (Conversational is the plain one).",
      "Press Write; the reply answers the latest comment that is not yours.",
      "Read it once and paste it in.",
    ],
    notes: [
      "A reply is short on purpose, at most 280 characters, and plainly punctuated.",
      "It quotes your experience only from your own profile text, and never invents a number or a client story.",
    ],
  },
  "inmail-composer": {
    summary: "Writes an InMail: the subject line and the message, from a profile you paste in.",
    steps: [
      "Paste the person's LinkedIn profile.",
      "Choose Text or Voice note, then the tone (ABCD Method to begin with).",
      "Press Write, then copy the subject and the message separately.",
    ],
    notes: [
      "ABCD Method ends by offering four replies, so answering costs the reader one letter.",
      "Voice note gives you a script to read aloud and record yourself, about 110 words, with the subject that carries it.",
      "The facts about you come from Profile Info, which you edit on My AI Profile, and About Me, which an admin edits under Administration → Global AI Prompts.",
    ],
  },
  "follow-up-message": {
    summary: "Writes the next follow-up from a conversation you paste in, with or without a pitch.",
    steps: [
      "Paste the conversation so far, and the person's profile if you have it.",
      "Pick the type: a follow-up that pitches, or one that does not.",
      "Press Write, read the message, and send it.",
    ],
    notes: [
      "Lead Signals reads the same conversation and says where the deal stands, in sixteen rows, beside the message.",
      "It will not claim a number or a case study your own profile does not support.",
    ],
  },
  "first-message": {
    summary: "Writes the first message to someone new, from their profile, in nine tones.",
    steps: [
      "Paste the person's LinkedIn profile.",
      "Choose Text or Voice note, then the tone.",
      "Press Write and copy the message.",
    ],
    notes: [
      "Post Interaction, Comment Interaction and Viewed + Accepted open with a fixed sentence for exactly that situation; pick one when that is what happened, since the app cannot see LinkedIn.",
      "Voice note is a script of about 110 words to record yourself.",
    ],
  },
  "connection-note": {
    summary: "Writes the note that goes with a connection request, inside LinkedIn's 300 characters, in eight tones.",
    steps: [
      "Paste the person's profile.",
      "Pick a tone. Recently Funded and Hiring Startup also ask for the company name.",
      "Press Write, check the character count, and send the request with the note.",
    ],
    notes: [
      "Funding, hiring and any figure must be in the profile you pasted or in the company name you gave; anything else is rewritten out.",
      "Post Interaction and Comment Interaction thank someone who engaged with your post or your comment, and ask for nothing.",
    ],
  },
  "conversation-reply": {
    summary: "Reads a conversation, says what is really going on in it, and writes the next reply in one of six tones.",
    steps: [
      "Paste the whole conversation, and the person's profile if you have it.",
      "Pick a tone (Validate + Share Pattern to begin with).",
      "Press Write, read the analysis beside the reply, then send the reply.",
    ],
    notes: [
      "Lead Signals shows the same sixteen rows Follow-Up uses, so you can see whether the deal is moving.",
      "Claims about your work are checked against your own profile and rewritten if they are not supported.",
    ],
  },
  "trending-topics": {
    summary: "Finds six fresh web, AI and SaaS topics by live web research, each with a post ready to publish.",
    steps: [
      "Press the search button; there is nothing to paste.",
      "Watch the stages while it searches, reads and writes.",
      "Read each topic's post, edit it in place, and copy it. The sources sit beside the post.",
    ],
    notes: [
      "A post carries no link, because LinkedIn shows a post with an external link to far fewer people; the source stays in the app.",
      "Every post is one of six shapes, so six posts never read alike, and each ends on a question.",
      "View Existing Topics keeps every topic ever found, with its LinkedIn searches on the row.",
      "One search is a lot of research, so it can take a minute or two.",
    ],
  },
  "post-image-creator": {
    summary: "Draws the image that goes with a post, in your own brand colours and with your own photo in it.",
    steps: [
      "Open Default Settings once: the name that goes on a post, your colours and your photos.",
      "Press New image, paste what the post is about, pick a photo and a pose, and choose the shape.",
      "Wait while it draws (35 to 130 seconds), then copy or download the image.",
    ],
    notes: [
      "Only your saved colours are used for the design, and a photographed person keeps their own face and skin.",
      "With no photo attached, the image has no people in it at all.",
      "Every image keeps the settings it was made with, so changing your colours never rewrites an older image.",
    ],
  },

  // ---------------------------------------------------------------- Client Work
  "meeting-planner": {
    summary: "The calendar for meetings that have not happened yet, and the preparation to walk into them with.",
    steps: [
      "Add a meeting: a name, a day, a time, and the attend link if you have one.",
      "Tick Repeat to make a series, and say how many meetings it holds.",
      "Paste the person's profile, your conversation so far and any notes, then ask for the preparation.",
      "Read the preparation before the call: who they are, what to cover, which projects to show and a nine-stage script.",
      "Open the script full screen during the call, or edit and reorder its stages first.",
      "Press the camera on a meeting, or Record this meeting on its page, to record the call; the recording is filed under that meeting.",
    ],
    notes: [
      "Ask this meeting is a chat that answers from the meeting's own notes, and says plainly when something is not in them.",
      "A meeting is pending, completed or cancelled, and a cancelled one stays on its day struck through.",
      "Notes on a meeting are yours to write before and after it, and no model ever reads them.",
      "A recorded meeting carries a Recorded tag; press it to open the recording.",
    ],
  },
  "client-voices": {
    summary: "Turns up to fifteen client voice messages into one transcript each, clear points, and two lists: the work asked for and the questions asked.",
    steps: [
      "Drop the voice files in, paste them from the clipboard, or pick them from your computer.",
      "Name the batch, or leave it empty and let the app name it from the voices.",
      "Watch each voice being written out, and try any that failed again on its own.",
      "Read the tasks and the questions side by side, and copy either list.",
    ],
    notes: [
      "Every batch is kept. View All Batches lists them all, and opening one plays the recordings and shows everything written from them.",
      "A question is never folded into the task list: one is something to do, the other something to answer.",
      "Each voice is also said again in a few clear points, beside the word-for-word transcript.",
      "Tick 'use these voices once' to have nothing kept at all.",
    ],
  },
  meetings: {
    summary: "Reads a whole meeting, however long, and gives you the participants, the decisions, your own tasks and a summary to send the client.",
    steps: [
      "Paste the transcript and save it, or press Quick record to record the meeting in the app with your voice, the laptop's sound and your microphone.",
      "A recording is saved when you stop, ready to watch. Press Transcribe and analyse on it when you want it written out and turned into notes.",
      "Type who was in it. A recording has no speaker labels, so the names you give are the ones the report uses.",
      "Wait while it reads the meeting part by part; closing the browser loses nothing.",
      "Read the notes, edit them in place, and copy the summary.",
    ],
    notes: [
      "Recording captures the screen, the laptop's sound, your microphone and your camera, and uploads while it records.",
      "The screen picker opens on Entire screen with system audio; check the audio switch is on, then press Share.",
      "Nothing is written out or analysed by itself, so a recording you never need costs nothing.",
      "Share this meeting gives a read-only link that plays the recording and shows the summary, with no sign-in.",
      "Editing the transcript marks the analysis as from the earlier text until you analyse it again.",
      "Link a meeting to one on the calendar, and the planner's own notes help name the people a recording never names.",
    ],
  },
  "client-messaging": {
    summary: "Writes a formal update to one client, in that client's own format, for whichever channel you send it on.",
    steps: [
      "Open Clients and give each client their message format and two sample messages.",
      "Choose the client, then the channel (LinkedIn, Upwork, Fiverr, Slack, Discord, WhatsApp or email).",
      "Type or speak what you want to tell them.",
      "Press Write, read it once, and send it.",
    ],
    notes: [
      "The samples are the shape to copy, never text to reuse, and the client's name never appears in the message.",
      "Only email has a subject line.",
      "This output is a formal update, so it is not put through the humanizer the LinkedIn tools use.",
    ],
  },
  "reference-content": {
    summary: "A searchable library of named text you send clients again and again: steps, procedures and explanations.",
    steps: [
      "Press Add, give the item a name, and paste the text.",
      "Search by name or by what the text says to find it again.",
      "Copy it whole with one button, or edit it in place.",
    ],
    notes: [
      "It is the curated twin of Quick Notes: this is what you keep and reuse, Quick Notes is what you drop and discard.",
      "An item can run to a million characters, and both fields are required.",
    ],
  },
  clients: {
    summary: "The clients themselves, their projects, and what every prompt written for a project should carry.",
    steps: [
      "Add a client with their name and country.",
      "Add their projects, and write the standing instructions every prompt written for that project should end with.",
      "Mark a project completed when it is done; it stays listed and says so.",
    ],
    notes: [
      "Prompt Creator's project picker reads this list, so a project added here can be written for at once.",
      "Every project gets a folder of its own in Prompt Creator, so its prompts are filed together without anyone moving them.",
      "Deleting a project keeps its prompts and their folder, and takes its own items with it.",
    ],
  },
  "client-projects": {
    summary: "Every client project in one table, each with its own page holding everything about it under ten tabs.",
    steps: [
      "Open a project with Manage.",
      "Explain the project under Overview: give each voice or description a name, record or paste the voice, and press Write it in English to read it back clearly.",
      "Write under the tab it belongs in: Changes, Product Ideas, Backlog, Discussion, Marketing Ideas, Sales Ideas, Credentials, Links, Documents or Backups.",
      "Give an item a description, images, files and a voice note, a priority, and on the backlog how long it should take.",
      "Drag each tab's list into the order you work it in, and move an item between the tabs people write on.",
      "Share this project to give the client a link they can write on without signing in.",
    ],
    notes: [
      "Credentials and Backups are never shown on a shared link, whatever the client does with the address.",
      "Documents and Links are filed in folders that nest; the other tabs are one list each.",
      "Every item keeps its own number down the side, so dragging the list never renumbers anything.",
      "A voice note runs up to fifteen minutes and is kept as a recording. Only an Overview voice can be written out, and only when you ask: it is written out word for word and read back in clear English, with both kept beside the recording.",
      "The client sees the Overview on the shared link and can add their own voices and descriptions there, and write them out too.",
    ],
  },

  // ---------------------------------------------------------------- Administration
  "finance-budget-management": {
    summary: "Coming soon: keeps your monthly budget, what comes in and where it goes.",
    steps: [
      "Open Finance on the sidebar's rail and choose Budget Management.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "finance-investment-plans": {
    summary: "Coming soon: keeps your investment plans, what you mean to invest in and how much.",
    steps: [
      "Open Finance on the sidebar's rail and choose Investment Plans.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "upwork-proposal-analyzer": {
    summary: "Coming soon: reads a proposal the way an Upwork client would, and says what to make stronger before you send it.",
    steps: [
      "Open Upwork Tools on the sidebar's rail and choose Proposal Analyzer.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "upwork-proposal-writer": {
    summary: "Coming soon: writes a proposal for one Upwork job post, in your own words and from your own profile.",
    steps: [
      "Open Upwork Tools on the sidebar's rail and choose Proposal Writer.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "upwork-client-conversation": {
    summary: "Coming soon: suggests the next reply in a conversation with an Upwork client, from what has been said so far.",
    steps: [
      "Open Upwork Tools on the sidebar's rail and choose Conversation with Client.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "fiverr-client-conversation": {
    summary: "Coming soon: suggests the next reply in a conversation with a Fiverr buyer, from what has been said so far.",
    steps: [
      "Open Fiverr Tools on the sidebar's rail and choose Conversation with Client.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "hubstaff-apply-on-job": {
    summary: "Coming soon: writes your application for one Hubstaff Talent job, from the job post and your own profile.",
    steps: [
      "Open Hubstaff Talent Tools on the sidebar's rail and choose Apply on Job.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "hubstaff-client-conversation": {
    summary: "Coming soon: suggests the next reply in a conversation with a Hubstaff Talent client, from what has been said so far.",
    steps: [
      "Open Hubstaff Talent Tools on the sidebar's rail and choose Conversation with Client.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  "hubstaff-related-video": {
    summary: "Coming soon: finds the video of your work that fits what a Hubstaff Talent client asked about, ready to send.",
    steps: [
      "Open Hubstaff Talent Tools on the sidebar's rail and choose Send the Related Video.",
      "For now its page says Coming soon: the tool is under development and will appear there when it is ready.",
    ],
  },
  administration: {
    summary: "The admin area: who signed in, what every account made, which AI model each module uses, the backups, and the sample data.",
    steps: [
      "Audit Management lists every sign-in, sign-up, sign-out and refused attempt, with the device and browser.",
      "User Management lists every account with its sign-in counts and what it made in each tool, and is where an account is deleted or has its tools turned on and off.",
      "AI Model Priority shows which model does each job, the AI spend, and lets you drag the order each module tries the providers in.",
      "Database Backup runs a backup now or downloads one, and lists every run, weekly or by hand.",
      "Dummy Data for Testing holds every tool's sample data: pick a tool, open an item, and use it in that tool.",
    ],
    notes: [
      "Only an admin sees this area, and its pages and routes refuse anybody else.",
      "A saved model order applies to admins' own requests; everyone else always gets the default order.",
      "Deleting an account removes everything it made, including its files, and needs its email typed to confirm.",
    ],
  },
}
