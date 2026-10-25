# Overview
Zaps is a small workflow automation app inspired by Zapier’s Zaps — a trigger plus an action — but not the rest of Zapier (marketplace, thousands of apps, billing, teams), is not a Zapier clone. And it stays close to that metaphor.
The first release must let people sign in with GitHub and run a Zap that comments on a pull request when one is opened. A natural-language Copilot that drafts Zaps is a stretch goal.

## Features
### Must-have
The Zap that must work end to end
- People sign in with GitHub (OAuth / SSO).
- They can create a Zap: GitHub pull request opened → comment on that same pull request.
- Opening a real PR on a repo they control makes that comment appear. In this version that means a **public** repo where the user has admin rights (needed to add the webhook).
- Zaps belong to the signed-in user; no one else can see or edit them.
- The builder can list, create and edit a Zap: name, on/off, trigger, action and some field mapping.
- The app picker includes several developer tools, such as GitLab, Jira, Linear and Slack. Only GitHub runs; the others show as coming soon.

### Nice-to-have
- A natural-language Copilot that drafts Zaps from natural language inside the same builder. The user reviews the draft and turns it on themselves. For example: "When a pull request is opened, comment thanks."

## Tech stack - MEAN stack
- MongoDB for persistence
- Node.js as the runtime
- Express on the server
- Angular for the front
- Typescript

Details, library versions and constraints: [Tech-Stack.md](Tech-Stack.md).

## Data model
Collections, fields, indexes and lifecycle rules: [Data-model.md](Data-model.md).

## API
Endpoints, DTOs, errors and webhook receiver: [API.md](API.md).

## Screens
Routes, wireframes, builder behavior and error handling: [Screens.md](Screens.md).

## Out of scope
A marketplace, other apps that actually run, billing, teams, multi-step Zaps and private repositories.
