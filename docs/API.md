# API.md: Game Otak Santai Bareng

## Authentication & Authorization

Authentication is handled primarily through `NextAuth.js`, which supports various providers (e.g., Google, Discord) and email/password. Upon successful authentication, the client receives a session token (e.g., JWT or session cookie) that must be included in subsequent API requests for authenticated endpoints.

**Authorization Header Format:**
For requests requiring authentication, include the session token in the `Authorization` header:

`Authorization: Bearer <YOUR_SESSION_TOKEN>`

**Authorization Levels:**
*   **Unauthenticated:** No token required.
*   **Authenticated User:** A valid session token for a regular user is required.
*   **Admin:** A valid session token for an administrator user is required.

## Standard Response & Pagination Formats

All API responses, both successful and erroneous, adhere to a consistent JSON structure.

**Success Response Format:**

```json
{
  "success": true,
  "data": {
    // Resource-specific data
  },
  "message": "Optional success message"
}
```

**Error Response Format:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "A human-readable error description."
  }
}
```

**Pagination Format:**
For endpoints returning lists of resources, pagination details will be included in the response data.

```json
{
  "success": true,
  "data": {
    "items": [
      // Array of resource objects
    ],
    "pagination": {
      "totalItems": 100,
      "currentPage": 1,
      "totalPages": 10,
      "itemsPerPage": 10
    }
  }
}
```

## API Endpoints

### User Management

#### Get User Profile

*   **Method:** `GET`
*   **Path:** `/api/v1/users/me`
*   **Description:** Retrieves the profile details of the currently authenticated user.
*   **Auth Level:** Authenticated User
*   **Request Body:** None
*   **Response Body (200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "id": "user_abc123",
        "username": "PlayerOne",
        "email": "player@example.com",
        "avatarUrl": "https://example.com/avatars/playerone.png",
        "totalGamesPlayed": 150,
        "wins": 75,
        "losses": 50,
        "soloHighScore": 12345,
        "createdAt": "2023-01-01T10:00:00Z"
      }
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Successfully retrieved user profile.
    *   `401 Unauthorized`: No authentication token provided or token is invalid.

### Game Room Management

#### Create Private Game Room

*   **Method:** `POST`
*   **Path:** `/api/v1/rooms/private`
*   **Description:** Creates a new private multiplayer game room and returns its unique code. The creating user is automatically designated as the host.
*   **Auth Level:** Authenticated User
*   **Request Body:**
    ```json
    {
      "maxPlayers": 4,
      "gameMode": "PixelPulse"
    }
    ```
*   **Response Body (201 Created):**
    ```json
    {
      "success": true,
      "data": {
        "roomId": "room_xyz789",
        "roomCode": "ABCD12",
        "hostId": "user_abc123",
        "maxPlayers": 4,
        "gameMode": "PixelPulse",
        "status": "waiting"
      },
      "message": "Private room created successfully. Share the room code to invite players."
    }
    ```
*   **Status Codes:**
    *   `201 Created`: Room successfully created.
    *   `400 Bad Request`: Invalid input (e.g., `maxPlayers` out of range).
    *   `401 Unauthorized`: No authentication token provided or token is invalid.

### Game State & Scoring

#### Save Solo Mode High Score

*   **Method:** `POST`
*   **Path:** `/api/v1/solo-scores`
*   **Description:** Submits a new high score for the authenticated user's solo game mode. The system will update the user's `soloHighScore` if the submitted score is higher than the current one.
*   **Auth Level:** Authenticated User
*   **Request Body:**
    ```json
    {
      "score": 15678,
      "gameDurationSeconds": 120
    }
    ```
*   **Response Body (200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "userId": "user_abc123",
        "newHighScore": 15678,
        "isNewRecord": true
      },
      "message": "Solo high score updated successfully."
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Score processed. `isNewRecord` indicates if it was a new personal best.
    *   `400 Bad Request`: Invalid score value.
    *   `401 Unauthorized`: No authentication token provided or token is invalid.

### Monetization

#### Purchase Cosmetic Item

*   **Method:** `POST`
*   **Path:** `/api/v1/shop/purchase`
*   **Description:** Initiates the purchase of a cosmetic item for the authenticated user. This endpoint would typically trigger a payment gateway interaction and then grant the item upon successful payment confirmation.
*   **Auth Level:** Authenticated User
*   **Request Body:**
    ```json
    {
      "itemId": "cosmetic_pixel_cursor_gold",
      "currency": "USD",
      "amount": 1.99
    }
    ```
*   **Response Body (200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "transactionId": "txn_def456",
        "userId": "user_abc123",
        "itemId": "cosmetic_pixel_cursor_gold",
        "status": "pending_payment_confirmation",
        "redirectUrl": "https://payment-gateway.com/checkout?txn=def456"
      },
      "message": "Purchase initiated. Redirecting to payment gateway."
    }
    ```
*   **Status Codes:**
    *   `200 OK`: Purchase initiated, awaiting payment confirmation.
    *   `400 Bad Request`: Invalid item ID or insufficient funds (if an in-game currency is used).
    *   `401 Unauthorized`: No authentication token provided or token is invalid.
    *   `404 Not Found`: Item not found.