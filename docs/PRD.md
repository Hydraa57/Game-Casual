# PRD: Game Otak Santai Bareng

## Executive Summary & Product Vision

This document outlines the requirements for "Game Otak Santai Bareng," a browser-based, real-time competitive casual game. The game features arcade-reflex mechanics with subtle brain-training elements, rendered in a retro pixel-art style. It supports both solo play and multiplayer sessions for 2-4 players, designed for quick, engaging fun that can be started and stopped with flexibility.

Our vision is to create the default browser game for social gatherings, offering a mentally stimulating yet fun experience that is instantly accessible without downloads or long-term commitments.

## Problem Statement & Target Users

**Problem:** Social groups often lack quick, accessible, and engaging activities that can be played on any device. Existing competitive games frequently require app installations, significant time investment per session, and penalize players for leaving mid-game.

**Target Users:**
*   **Primary:** Socially active young adults (18-30) looking for a fun, competitive game to play with friends during hangouts.
*   **Secondary:** Individuals seeking short, mentally stimulating browser-based games for breaks during work or study.

## System Scope & User Roles

The system encompasses a web-based game client, a real-time multiplayer backend, and a basic admin panel for system oversight.

| Permission | Unauthenticated User | Authenticated User | Admin |
|:----------------------------|:--------------------:|:------------------:|:-------------:|
| View Landing Page | ✅ | ✅ | ✅ |
| Play Solo Mode (Guest) | ✅ | ✅ | ✅ |
| Register / Login | ✅ | ❌ | ❌ |
| Join Public Multiplayer Match | ❌ | ✅ | ✅ |
| Create Private Room | ❌ | ✅ | ✅ |
| Join Private Room with Code | ❌ | ✅ | ✅ |
| View Personal Profile/Stats | ❌ | ✅ | ✅ |
| Purchase Cosmetics (IAP) | ❌ | ✅ | ❌ |
| Access Admin Dashboard | ❌ | ❌ | ✅ |
| Manage Users (View/Ban) | ❌ | ❌ | ✅ |

## Functional Requirements

**User-Facing Requirements**
*   **FR-01 (Authentication):** Users must be able to register and log in using social providers (e.g., Google, Discord) or email/password via NextAuth.js.
*   **FR-02 (Game Lobby):** After login, the user is presented with a main menu to select: "Solo Practice," "Join Public Match," or "Create Private Room."
*   **FR-03 (Solo Mode):** A user can play an endless version of the core game. The game ends when the user makes a set number of mistakes. High scores are saved to the user's profile.
*   **FR-04 (Solo Pause):** In Solo Mode ONLY, the user can pause the game. The game state is maintained, and the game can be resumed from the exact same point.
*   **FR-05 (Private Room Creation):** A logged-in user can create a private game room, which generates a unique, shareable room code. The creator is the room host.
*   **FR-06 (Real-time Multiplayer):** Up to 4 players in a room compete in a real-time, session-based match. Game state (scores, player actions) is synchronized across all clients via WebSockets.
*   **FR-07 (Core Gameplay - "Pixel Pulse"):** The game board is a grid. Pixels of various colors flash randomly. A central UI element dictates the "target color." Players must click pixels of the target color before they fade. The target color changes periodically. Points are awarded for speed and accuracy.
*   **FR-08 (Competitive Scoring):** In multiplayer, a live leaderboard is displayed during the match, showing player scores. The first player to reach a target score, or the player with the highest score after a time limit, wins.
*   **FR-09 (User Profile & Stats):** Authenticated users have a profile page displaying their username, avatar, match history, win/loss ratio, and solo mode high scores.
*   **FR-10 (Cosmetic IAP):** Users can purchase purely cosmetic items, such as custom pixel cursors, player avatar frames, or alternative game board themes, through an integrated payment gateway.

**Admin-Facing Requirements**
*   **FR-11 (Admin Dashboard):** A secure web interface for Admins to view key metrics: Daily Active Users (DAU), concurrent player count, and total games played.
*   **FR-12 (User Management):** Admins can search for users by username or email and have the ability to issue temporary or permanent bans.

## Non-Functional Requirements

| Category | Requirement |
|:--------------|:--------------------------------------------------------------------------------------------------------|
| **Performance** | - Game client initial load time < 3 seconds on a standard broadband connection. - Client-server latency for game actions < 150ms. - Server tick rate for game state updates ≥ 20Hz. |
| **Scalability** | - The system must support 1,000 concurrent users for the initial launch. - Backend infrastructure must be horizontally scalable to handle traffic spikes. |
| **Availability**| - Core game services (login, matchmaking, gameplay) must maintain 99.5% uptime. |
| **Security** | - All client-server communication must use TLS. - Server-side validation of all critical game actions (e.g., scoring) to prevent cheating. - User passwords must be hashed and salted. |
| **Usability** | - The game must be playable on all modern desktop browsers (Chrome, Firefox, Safari, Edge). - UI must be responsive and intuitive, requiring minimal instruction. |

## Technology Stack & Rationale

| Component | Technology | Rationale |
|:---------------------|:---------------------------|:------------------------------------------------------------------------------------------------------|
| Frontend Game Engine | Phaser | A mature and powerful 2D JavaScript framework ideal for browser-based pixel art and arcade games. |
| Backend Framework | Node.js + Express | Efficient, non-blocking I/O is perfect for handling many concurrent connections in a real-time game. |
| Real-time Protocol | Socket.IO | Provides a robust WebSocket implementation with fallback mechanisms and simple room management APIs. |
| Database | PostgreSQL | A reliable, relational database for structured data like user profiles, scores, and transaction records. |
| Authentication | NextAuth.js | Simplifies secure authentication with multiple social providers, integrating well with a modern JS frontend. |
| Hosting | Vercel (Frontend) & Render (Backend) | Offers seamless CI/CD, generous free tiers for initial development, and easy, independent scaling. |

## Success Metrics & KPIs

| Metric | KPI Target (First 6 Months) |
|:----------------------------|:-----------------------------------------------------------|
| Daily Active Users (DAU) | Achieve 500 average DAU. |
| Player Retention (Day 7) | > 20% of new users return after 7 days. |
| Average Session Length | > 15 minutes for multiplayer sessions. |
| Private Room Creation Rate | > 30% of daily multiplayer matches are in private rooms. |
| IAP Conversion Rate | > 1% of monthly active users make at least one purchase. |

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation Strategy |
|:-----------------------------------|:-------|:----------------------------------------------------------------------------------------------------------------|
| **High Network Latency** | High | Optimize netcode to minimize packet size. Implement client-side prediction and server reconciliation. Deploy backend to regions physically closer to the target user base. |
| **Cheating/Exploits** | High | Implement authoritative server architecture where the server validates all critical game logic (e.g., scoring, hit detection). Add basic rate-limiting on inputs. |
| **Low Player Adoption/Engagement** | High | Conduct pre-launch playtesting with the target audience. A/B test different game mechanic variations (e.g., speed, scoring rules). Release new cosmetic content regularly. |
| **Scalability Failure** | Medium | Design the backend as stateless services to allow for horizontal scaling. Perform load testing with tools like k6 or Artillery before launch to identify and fix bottlenecks. |

## Constraints & Assumptions

**Constraints:**
*   The application must be browser-based; no native mobile or desktop clients will be developed for this version.
*   The visual aesthetic is strictly retro pixel art.
*   The pause/resume feature is only available in solo mode. Multiplayer games cannot be paused.
*   Monetization is limited to cosmetic and non-gameplay-affecting feature IAPs.

**Assumptions:**
*   Users will have a modern web browser that supports WebSockets and WebGL.
*   A stable, low-latency internet connection is required for a satisfactory multiplayer experience.
*   The primary user acquisition channel will be social sharing (word-of-mouth).

## Out of Scope

The following features will NOT be included in the initial release:
*   Native mobile (iOS/Android) or desktop applications.
*   In-game text or voice chat.
*   A complex story mode or single-player campaign.
*   Player-to-player trading of cosmetic items.
*   Guilds, teams, or other complex social structures.
*   Offline play mode.