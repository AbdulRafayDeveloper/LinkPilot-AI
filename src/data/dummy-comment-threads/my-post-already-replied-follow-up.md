---
name: My post, I already replied, they commented again (fictional)
createdAt: 2026-09-12T00:00:03.000Z
---

<!-- field: post -->
Abdul Rafay
Full Stack AI Developer
4d •

Most SaaS MVPs don't need microservices. We shipped a client's MVP as a single Next.js app with one PostgreSQL database, and it handled their first 5,000 users without a single scaling issue.

Start simple. Split things up when real traffic forces you to, not before.

#saas #mvp #nextjs #webdevelopment

<!-- field: comments -->
Tom Becker
 • 3rd+
Engineering Manager at Parcelio
3d
Did you use serverless functions or a regular server for the API side?
Like
 · 
Reply

Abdul Rafay
 • Author
Full Stack AI Developer
3d
Regular Next.js API routes on a single server, Tom. Serverless wasn't needed at that traffic level.
Like
 · 
Reply

Hira Qureshi
 • 2nd
Head of Support at Cartwise
2d
Agree on starting simple. What made you confident one database would be enough?
Like
 · 
Reply

Abdul Rafay
 • Author
Full Stack AI Developer
2d
Mostly the numbers, Hira. Their traffic estimate was a few hundred active users a day, which one PostgreSQL instance handles easily.
Like
 · 
Reply

Hira Qureshi
 • 2nd
Head of Support at Cartwise
5h
Makes sense. But what's the first sign that it's time to split things up? We're at that point where everything feels slow and I can't tell if it's the database or our code.
Like
 · 
Reply
