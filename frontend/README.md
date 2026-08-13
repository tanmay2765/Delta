# Delta Meet

You are a senior frontend engineer and UI implementation specialist.

I am building a full-stack video-conferencing application called "Delta".

I have provided multiple reference images for the UI. These images are the PRIMARY VISUAL SOURCE OF TRUTH.

Your task is to build the COMPLETE frontend from these reference images.

DO NOT create screenshots.

DO NOT embed the reference images into the application.

DO NOT create a static mockup.

Rebuild the interfaces as a REAL, FUNCTIONAL Next.js application using React, TypeScript and Tailwind CSS.

============================================================

REFERENCE IMAGES

============================================================

The reference images represent the following screens:

1. Dashboard

2. New Meeting / Instant Meeting

3. Join Meeting

4. Schedule Meeting

5. Meeting Room

6. Meeting Room with Participants Panel and interaction states

7. Login / Signup

Study ALL reference images before writing substantial code.

Treat them as one unified design system.

The application must look like ONE coherent product called Delta.

============================================================

TECH STACK

============================================================

Use:

- Next.js

- TypeScript

- React

- Tailwind CSS

- App Router

- Lucide React for icons or another consistent icon library

Use clean, maintainable React architecture.

Do NOT use unnecessary libraries.

============================================================

CORE REQUIREMENT — VISUAL FIDELITY

============================================================

Recreate the reference designs as closely as reasonably possible.

Pay very close attention to:

- layout

- proportions

- spacing

- padding

- margins

- typography

- font sizes

- font weights

- line heights

- colors

- backgrounds

- glassmorphism

- transparency

- backdrop blur

- borders

- shadows

- corner radius

- button dimensions

- input dimensions

- sidebar dimensions

- navbar dimensions

- card dimensions

- icon sizes

- alignment

- visual hierarchy

Do not casually approximate the screenshots.

Do not redesign the UI.

Do not replace the design with a generic SaaS dashboard.

The reference images are the target.

============================================================

DELTA DESIGN SYSTEM

============================================================

Extract a reusable design system from the reference images.

Create shared design tokens/components for:

- background

- foreground

- primary blue

- secondary colors

- muted text

- glass surfaces

- glass borders

- shadows

- blur

- border radius

- spacing

- typography

Use CSS variables/Tailwind configuration where appropriate.

All pages must use the SAME:

- typography

- colors

- buttons

- inputs

- glass cards

- borders

- shadows

- icon style

- spacing

- corner radius

Do not independently invent styling for every page.

============================================================

GLASSMORPHISM

============================================================

The reference design uses a modern glassmorphism aesthetic.

Implement it properly using:

- translucent backgrounds

- backdrop-filter blur

- subtle opacity

- thin borders

- layered surfaces

- restrained shadows

- subtle blue glow

- depth between foreground and background

Do NOT make every element transparent.

Do NOT turn the UI into excessive neon/glow effects.

Maintain readability and professional usability.

============================================================

APPLICATION STRUCTURE

============================================================

Create these routes:

/

    Dashboard

/login

    Login

/signup

    Signup

/new-meeting

    New Meeting / Instant Meeting

/join

    Join Meeting

/schedule

    Schedule Meeting

/meeting/[meetingId]

    Meeting Room

The Participants Panel should be a state/component inside the meeting room rather than a duplicated meeting-room page.

============================================================

SHARED APPLICATION SHELL

============================================================

Create reusable components.

Suggested architecture:

components/

├── layout/

│ ├── AppShell.tsx

│ ├── Sidebar.tsx

│ ├── Topbar.tsx

│ └── MobileNav.tsx

│

├── ui/

│ ├── GlassCard.tsx

│ ├── Button.tsx

│ ├── Input.tsx

│ ├── Select.tsx

│ ├── Modal.tsx

│ ├── Avatar.tsx

│ └── StatusBadge.tsx

│

├── dashboard/

│ ├── QuickActions.tsx

│ ├── UpcomingMeetings.tsx

│ ├── RecentMeetings.tsx

│ └── MeetingCard.tsx

│

├── meetings/

│ ├── MeetingPreview.tsx

│ ├── MeetingControls.tsx

│ ├── ParticipantTile.tsx

│ ├── ParticipantsPanel.tsx

│ ├── MeetingInfo.tsx

│ └── InviteModal.tsx

│

└── auth/

    ├── AuthLayout.tsx

    ├── LoginForm.tsx

    └── SignupForm.tsx

You may modify this architecture if a better structure is appropriate.

The important requirement is:

REUSABLE COMPONENTS.

Do not duplicate the same UI code across pages.

============================================================

PAGE 1 — DASHBOARD

============================================================

Recreate the Dashboard reference image.

Include the visual elements shown in the reference:

- Delta branding

- sidebar

- top navigation

- search

- notifications

- profile

- greeting/page heading

- New Meeting

- Join Meeting

- Schedule Meeting

- Upcoming Meetings

- Recent Meetings

- meeting cards

- statistics/summary elements shown in the reference

The dashboard must look like the supplied reference image.

Buttons must actually navigate to their respective pages.

============================================================

PAGE 2 — NEW MEETING / INSTANT MEETING

============================================================

Recreate the supplied New Meeting reference.

Include:

- page header

- meeting title

- host information

- description

- camera preview

- microphone control

- camera control

- Start Meeting button

- Cancel/Back button

- meeting preview

- success state

- Meeting ID

- invite link

- Copy Invite Link

- Share

- Enter Meeting

The success state should be controlled by React state.

Do not show the success modal permanently.

Start Meeting should eventually create a real meeting through the backend.

============================================================

PAGE 3 — JOIN MEETING

============================================================

Recreate the Join Meeting reference.

Include:

- Meeting ID / Personal Link input

- display name

- camera preview

- microphone state

- camera state

- Join Meeting button

- Back button

- meeting preview/information

- validation/error states

Join Meeting should eventually call the backend.

============================================================

PAGE 4 — SCHEDULE MEETING

============================================================

Recreate the Schedule Meeting reference.

Include:

- title

- description

- date

- time

- duration

- timezone

- participants

- meeting summary

- Schedule Meeting button

- Cancel button

- success confirmation state

- generated Meeting ID

- generated invite link

- Copy Invite Link

- Add to Calendar

- Done

Success state must be an actual application state, not permanently visible.

============================================================

PAGE 5 — MEETING ROOM

============================================================

Recreate the supplied Meeting Room reference.

This page should be visually different from the dashboard:

- dark immersive meeting interface

- large video area

- participant video tiles

- top meeting information

- meeting duration

- connection status

- participant count

- bottom meeting controls

Controls:

- Microphone

- Camera

- Participants

- Chat

- Share Screen

- Record

- More

- Leave

Controls must actually respond to clicks.

Actual WebRTC/video streaming is NOT required unless already implemented by the backend.

Use realistic video/avatar placeholders while keeping the UI functional.

============================================================

PAGE 6 — PARTICIPANTS PANEL / MEETING STATES

============================================================

Implement this as an interactive state of the Meeting Room.

Participants panel:

- open/close

- search participants

- participant list

- host indicator

- microphone state

- camera state

- Invite People button

Implement realistic states:

- active speaker

- muted participant

- camera-off participant

- unread chat badge

- screen-sharing indicator

- participants panel open

- participants panel closed

Use React state.

Do not create fake buttons that do nothing.

============================================================

PAGE 7 — LOGIN / SIGNUP

============================================================

Recreate the supplied authentication reference.

Routes:

/login

/signup

Login:

- email

- password

- remember me

- forgot password

- Sign In

- Google/GitHub buttons if shown in reference

- link to Signup

Signup:

- name

- email

- password

- confirm password

- terms checkbox

- Create Account

- link to Login

Use the same Delta branding, typography, blue accent and glassmorphism.

Do not use the authenticated sidebar on Login/Signup.

Login and Signup should be two states/pages of the same authentication design.

Real authentication can remain unimplemented unless an authentication backend already exists.

============================================================

FUNCTIONAL NAVIGATION

============================================================

Implement actual navigation:

Dashboard

→ New Meeting

Dashboard

→ Join Meeting

Dashboard

→ Schedule Meeting

New Meeting

→ Meeting Room

Join Meeting

→ Meeting Room

Schedule Meeting

→ Dashboard

Meeting Room

→ Dashboard when Leave is clicked

Login

→ Dashboard after successful mock login

Signup

→ Login or Dashboard according to the existing flow

Use Next.js routing properly.

============================================================

STATE MANAGEMENT

============================================================

Use React state for UI behavior.

At minimum:

New Meeting:

- form values

- camera state

- microphone state

- success modal

Join:

- form values

- camera state

- microphone state

- validation errors

Schedule:

- form values

- selected participants

- success modal

Meeting Room:

- microphone state

- camera state

- participants panel

- chat notification

- screen sharing state

- active speaker

- participant states

- leave meeting

============================================================

BACKEND INTEGRATION

============================================================

There is an existing FastAPI backend.

FIRST inspect the backend.

Do not invent endpoint names if equivalent endpoints already exist.

The frontend should eventually communicate with:

http://localhost:8000

Use:

NEXT_PUBLIC_API_URL=http://localhost:8000

Create:

lib/api.ts

Centralize all API requests there.

Do not scatter fetch calls throughout components.

Use real backend data for:

- upcoming meetings

- recent meetings

- instant meeting creation

- meeting scheduling

- joining meetings

- meeting details

- participants

If the backend is not yet implemented for some feature, keep the UI architecture ready for integration and clearly identify the missing endpoint rather than silently creating fake permanent functionality.

============================================================

RESPONSIVE DESIGN

============================================================

The supplied reference images are primarily desktop designs.

Create responsive layouts for:

- desktop

- tablet

- mobile

Do NOT simply shrink the desktop UI.

Desktop:

1440px+

Tablet:

768px–1023px

Mobile:

320px–767px

On mobile:

- sidebar becomes mobile navigation

- cards stack

- grids become one-column where appropriate

- forms fit the viewport

- meeting controls remain usable

- participant panel becomes a drawer/sheet

- meeting video tiles adapt

- buttons remain accessible

- no horizontal scrolling

- typography scales appropriately

Maintain the same Delta design language at all breakpoints.

============================================================

CODE QUALITY

============================================================

Use:

- TypeScript types

- reusable components

- clean naming

- proper separation of concerns

- no duplicated code

- no unnecessary dependencies

- accessible buttons/forms

- semantic HTML where appropriate

- proper loading states

- proper error states

- proper empty states

Avoid:

- giant page components

- inline styles everywhere

- hardcoded repeated values

- duplicated UI

- unnecessary useEffect

- random CSS

- placeholder lorem ipsum

- fake functionality

============================================================

IMPORTANT VISUAL RULE

============================================================

DO NOT redesign any of the reference screens.

DO NOT make your own interpretation of the layout if the reference already specifies it.

When a reference image shows a particular:

- card size

- sidebar width

- button position

- spacing

- alignment

- glass effect

- color

- typography hierarchy

try to reproduce it.

The objective is:

REFERENCE IMAGE

        ↓

REAL NEXT.JS IMPLEMENTATION

not:

REFERENCE IMAGE

        ↓

GENERIC SIMILAR WEBSITE

============================================================

IMPLEMENTATION ORDER

============================================================

Build in this exact order:

1. Global design system

2. Shared layout/components

3. Dashboard

4. New Meeting

5. Join Meeting

6. Schedule Meeting

7. Meeting Room

8. Participants/meeting states

9. Login/Signup

10. Responsive layouts

11. Backend integration

12. Final testing

Do not attempt to implement everything as one giant component.

============================================================

VISUAL QA

============================================================

After implementation:

Run the application.

Check every route.

Compare every page against its corresponding reference image.

Look specifically for:

- spacing differences

- incorrect card sizes

- incorrect sidebar width

- incorrect typography

- incorrect colors

- incorrect glassmorphism

- incorrect button sizes

- incorrect alignment

- inconsistent components

- mobile overflow

- broken layouts

Fix the biggest visual discrepancies.

Also check:

- TypeScript errors

- build errors

- console errors

- broken routes

- API errors

- missing imports

- broken responsive behavior

Do not stop after generating code.

Actually run and verify the application.

============================================================

FINAL OUTPUT

============================================================

When finished, report:

1. All files created/modified

2. All routes created

3. All reusable components created

4. Design system implemented

5. Backend APIs connected

6. Functional interactions implemented

7. Responsive breakpoints implemented

8. Commands to run the frontend

9. Any backend functionality that is still missing

10. Any limitations that remain

Most importantly:

BUILD THE APPLICATION.

Do not just explain how to build it.

Do not give me snippets.

Do not stop at a plan.

Inspect the reference images and existing project first, then implement the complete frontend.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4ffaa0fb-b7a7-4472-88f8-31a477c56cb4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
