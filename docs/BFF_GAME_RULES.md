# TexasNomad Games — BFF Official Game Rules

## Game Identity

**BFF** = **Big Family Feud**

BFF is a live, Host-judged family-vs-family game built for TexasNomad Games.

The game is controlled from the Host Panel. Players join from their own devices, can use live microphones, and follow turn/buzzer state controlled by the game engine.

The Host is the final judge of whether a spoken answer matches a survey answer. The system must never reject an answer automatically based on wording.

---

# REGULAR GAME

## Match Length

A standard BFF match is **5 rounds**.

After Round 5:
- The family with the highest total score advances to the **Family Dysfunction** finale.
- If tied after Round 5, use a tiebreak procedure before Family Dysfunction.

---

# ROOM SETUP

Before **Start Round** becomes available:

1. Both family names must be entered.
2. Players must be assigned to families.
3. Each family can contain up to **6 players**.
4. Player order inside the family roster matters and is used for turn rotation.
5. All players should have microphone permission enabled before gameplay begins.

The Host microphone is available to all players unless the Host manually mutes themself.

Players cannot mute the Host inside BFF.

---

# AUDIO ROUTING

## Host Audio

The Host is broadcast to **all connected players** unless the Host manually mutes their own microphone.

## Player Audio

Players may leave their microphones enabled throughout the game, but the game controls who is actually broadcast.

Only the current active player is routed to:
- the Host
- all connected players

This prevents multiple players from talking over each other.

## Faceoff Audio

During faceoff:
- no player audio is broadcast until a buzzer winner is established
- the buzzer winner's microphone opens automatically
- that player is heard by everyone

## Family Play Audio

During family play:
- only the current active player's microphone is broadcast

## Steal Audio

During steal:
- the first eligible player to buzz becomes the active player
- that player's microphone opens to everyone

---

# ROUND START

**Start Round**:

1. Randomly selects a survey.
2. Does not repeat a survey until the active survey pool has been exhausted.
3. Loads the survey question and ranked answers.
4. Resets:
   - Round Bank
   - B/Y/E strikes
   - buzzer winner
   - active player
   - steal state
   - faceoff state
   - timeout streak
5. Does **not** automatically open buzzers.

The Host must select the faceoff players first.

---

# FACEOFF

## Selecting Faceoff Players

The Host selects:
- one player from Family 1
- one player from Family 2

The selected names highlight inside the family cards.

Only these two players are eligible to buzz.

## Activating Buzzers

The Host uses **Activate Buzz**.

The buzzer remains visible on every player screen, but only the selected faceoff players can activate it.

The Host can deactivate the buzzers at any time.

## First Buzz

The first valid buzzer press:

1. Locks out the other faceoff buzzer.
2. Plays the buzzer sound automatically.
3. Highlights the buzzer winner.
4. Opens that player's microphone to everyone.
5. Starts a **15-second answer timer**.

## Faceoff Answer — Correct

The Host reveals the matching answer.

This:
- reveals the answer to players
- adds the answer value to the Round Bank
- plays **DING**
- immediately follows with **one APPLAUSE**
- records the answer's ranking/value for determining faceoff control

The applause must fire exactly once per newly revealed correct answer.

## Faceoff Answer — Wrong

The Host uses the special **X** control.

This:
- displays a large X on the game board
- plays the wrong-answer buzzer sound
- does **not** add a B/Y/E strike
- passes the answer opportunity to the other faceoff player

The Faceoff X is completely separate from the B/Y/E strike system.

## Faceoff Timeout

A faceoff player gets **15 seconds** to answer.

If time expires:
- no B/Y/E strike is given
- the answer opportunity passes to the other faceoff player

## Both Faceoff Players Miss

If both selected players miss:

1. Move to the next player in each family's roster.
2. Those two players become the new faceoff pair.
3. Continue cycling through both families until everyone has had one faceoff opportunity.

If every eligible player on both families has attempted the faceoff and nobody gives a correct answer:

- Family 1 loses **5 points**
- Family 2 loses **5 points**
- the round ends with no Round Bank awarded

---

# PLAY / PASS

After a family wins the faceoff, the faceoff winner receives a choice:

- **PLAY**
- **PASS**

## PLAY

If PLAY is chosen:
- the winning family takes control
- the next player after the faceoff winner in that family's roster answers first
- normal family rotation begins

## PASS

If PASS is chosen:
- the opposing family takes control
- the first active player is the player immediately after that family's faceoff player in roster order
- normal family rotation begins

---

# FAMILY PLAY

## Turn Order

Family play follows roster order.

Example:

Players:
1. A
2. B
3. C

If B participated in the faceoff and the family chooses PLAY:

- C answers next
- then A
- then B
- and the cycle continues

The active player's name is highlighted in the family card.

## Family Play Timer

Each regular family-play answer gets **20 seconds**.

## Correct Answer

The Host reveals the matching answer.

This:
- reveals it to players
- adds its point value to the Round Bank
- plays DING
- then plays one APPLAUSE
- advances to the next player in roster order

## Wrong Answer

The Host clicks the next available B/Y/E strike.

This:
- adds one B/Y/E strike
- plays the wrong sound
- then plays the AWWWW sound
- advances to the next player

## Timeout

A normal 20-second timeout:

- does not immediately create a B/Y/E strike
- advances to the next player

However:

**Two consecutive family-play timeouts = one B/Y/E strike.**

After that strike:
- the consecutive-timeout counter resets to zero

Any valid answer or Host-judged wrong answer also resets the consecutive-timeout counter as appropriate.

---

# B / Y / E STRIKES

The B/Y/E system applies only during family play.

The letters activate in order:

- B
- Y
- E

At three strikes:
- family play ends
- the opposing family receives one steal opportunity

The Faceoff X is never counted as a B/Y/E strike.

---

# STEAL

When three B/Y/E strikes are reached:

1. The opposing family becomes the stealing family.
2. Steal buzzers open to the eligible next-family players.
3. The first valid buzzer wins the steal attempt.
4. That player's microphone opens to everyone.
5. The Host judges one answer.

## Successful Steal

If the Host reveals a correct unrevealed answer:

- the stealing family receives the **entire Round Bank**
- the round ends

## Failed Steal

If the Host marks the steal answer wrong:

- the original playing family receives the **entire Round Bank**
- the round ends

---

# ANSWER SCORING

Answers use ranked Family-Feud-style values rather than equal values.

Current scale:

| Answer Count | Values |
|---|---|
| 1 | 100 |
| 2 | 65 / 35 |
| 3 | 50 / 30 / 20 |
| 4 | 40 / 30 / 20 / 10 |
| 5 | 35 / 25 / 18 / 13 / 9 |
| 6 | 30 / 23 / 18 / 13 / 9 / 7 |
| 7 | 28 / 22 / 17 / 13 / 9 / 6 / 5 |
| 8 | 25 / 20 / 16 / 13 / 10 / 7 / 5 / 4 |

The highest-ranked answer must always be worth the most.

---

# HOST JUDGING

The Host sees:
- survey question
- all answer text
- all answer values
- reveal state

Players see:
- question
- covered answer slots
- revealed answers only

There is no automatic fuzzy answer matching in live BFF.

The Host decides whether spoken answers count.

Example:

Stored answer:
> FOOD

Player says:
> Chips

The Host may accept the answer and reveal FOOD.

---

# FAMILY DYSFUNCTION

After five regular rounds, the family with the highest total score advances to the **Family Dysfunction** finale.

Family Dysfunction is not trivia and does not reuse normal BFF survey gameplay.

It is a family-vs-itself social showdown.

## Team Split

The winning family is divided into two sides.

Preferred:
- **3 vs 3**

The finale should dynamically support:
- 2 vs 2
- 3 vs 2
- 3 vs 3

Players should not be disqualified from the finale simply because fewer than six family members are connected.

---

# FAMILY DYSFUNCTION — CORE GAME

Each prompt asks players to identify a member of the opposing side who best fits a dysfunctional-family description.

Examples:

- Who is most likely to borrow money and conveniently forget?
- Who would start an argument at Thanksgiving?
- Who takes 45 minutes to get ready and still shows up late?
- Who would survive the least amount of time without their phone?
- Who is most likely to expose the family group chat?
- Who would absolutely snitch?
- Who thinks they're the favorite child?
- Who would spend the family vacation money first?

## Voting

Each player secretly selects **one member of the opposing side**.

Selections stay hidden until everyone on that side has voted.

Then all selections reveal together.

## Dysfunction Scoring

For a 3-person side:

- all 3 choose the same opponent = **3 points**
  - display: **DYSFUNCTION!**
- 2 of 3 agree = **2 points**
- all 3 choose different people = **0 points**
  - play AWWWW

For smaller sides, scoring should scale proportionally while rewarding unanimous agreement most strongly.

## Prompt Count

Family Dysfunction uses **5 prompts**.

Both sides respond to each prompt about the opposite side.

Highest Dysfunction score after five prompts wins.

---

# THE DEFENSE

After selections reveal:

- the person receiving the most votes gets **10 seconds**
- their microphone opens automatically
- everyone hears them
- they get to defend themselves

This is intentionally comedic and part of the finale.

Example:

Prompt:
> Who is most likely to start family drama?

If everyone votes for Dexter:

Dexter gets 10 seconds on open mic to explain why everybody else is wrong.

---

# FAMILY DYSFUNCTION TIEBREAKER

If tied after five prompts:

Use **Sudden Death Dysfunction**.

1. Host receives one additional high-impact prompt.
2. Both sides vote.
3. First side to achieve unanimous agreement on the same opponent wins.

---

# AUDIO / SOUND RULES

Sound events must be event-based and fire once.

They must never replay because of:
- polling
- page refresh
- reconnect
- stale room state

## Correct Answer

1. DING
2. APPLAUSE

Exactly once.

## Wrong Family-Play Answer

1. Wrong-answer sound
2. AWWWW

## Faceoff Wrong Answer

- wrong-answer sound only
- large X visual
- no AWWWW requirement unless deliberately added later

## Buzzer

- fires immediately when the valid first buzzer claim is accepted

---

# HOST PANEL REQUIRED CONTROLS

Core controls:

- Start Round
- Reset Round
- Next Question
- Undo
- Reveal selected answer
- Hide selected answer
- Manual points adjustment
- Select Family 1 faceoff player
- Select Family 2 faceoff player
- Activate Buzz
- Deactivate Buzz
- Faceoff X
- PLAY
- PASS
- B
- Y
- E
- Steal state
- Award Round Bank when necessary
- Player/family assignment
- Host mute/unmute

Controls should appear only when relevant to the current game state whenever practical.

---

# PLAYER VIEW REQUIRED STATE

Player view should always show:

- family cards
- family names
- family scores
- family player names
- current active player highlight
- selected faceoff player highlight
- current question
- answer board
- Round Bank
- B/Y/E strikes
- Steal state
- Buzzer panel

The buzzer panel stays visible but only becomes active when the game engine allows that player to buzz.

Players should not be able to bypass eligibility through UI or direct API calls.

---

# IMPLEMENTATION PRINCIPLE

BFF is a **state-machine-driven live game**, not a collection of independent controls.

The engine must always know the current stage:

1. setup
2. round loaded
3. faceoff setup
4. faceoff buzzing
5. faceoff answering
6. play/pass
7. family play
8. steal
9. round complete
10. next round
11. match complete
12. Family Dysfunction
13. finale complete

The UI should react to the game state rather than manually recreating game logic in multiple places.
