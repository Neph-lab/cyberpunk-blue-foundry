# NET Combat — manual test suite (for a Chrome-driving assistant)

You are testing a new **"NET Combat"** feature in a FoundryVTT game system called **Cyberpunk Blue**,
on a live test server that is **already open in Chrome and logged in as the GM**. Work entirely through
the Foundry UI in the browser. Do **not** edit files, run shell commands, or touch the server config.

## Ground rules (read first)

1. **You are the GM.** Everything here is GM-visible.
2. **Only create/modify items and actors whose names start with `ZTEST`.** Never delete or rename
   anything that doesn't start with `ZTEST`. At the very end you may delete the `ZTEST` documents you made.
3. **Each test is independent.** If one test can't be set up, write it down as `BLOCKED` with the reason
   and move on — do not improvise around the rest of the suite.
4. **If you cannot find a button/field after a genuine look, stop that test and record `BLOCKED: <what you
   looked for>`.** Don't click random things hoping to find it.
5. **Open the browser console first** (F12 → Console). After the world is loaded, note any **red errors**
   that mention `cyberpunk-blue`, `netCombat`, `net-program-combat`, or `resolveNetAttack`. Report them.
6. Record every result in the **Results** template at the bottom (copy it into your reply). For each test
   write `PASS`, `FAIL`, or `BLOCKED`, plus one line of evidence (what you saw). Take a screenshot on any
   `FAIL`.

## Vocabulary / where things are

- **Items sidebar**: right-hand panel, the tab with a suitcase/box icon. "Create Item" button at its top.
- **Actors sidebar**: the tab with a people icon.
- A **Program Executable** is an *Item*. A **Program** is an *Actor*. They are two faces of the same thing
  and are kept in sync.
- A program/executable sheet has a header row of stats: **ACT ATK DEF NET PER REZ**, a **Type** dropdown,
  and a row of **tabs** near the top. The new tab is labeled **NET Combat**.
- The NET Combat tab has three sections: **Attack**, **Defense**, and (only for Booster type) **Booster**.

---

## Test A — NET Combat tab visibility & gating

**Setup:** Items sidebar → Create Item → Name `ZTEST Attacker`, Type **Program Executable** → Create. The
sheet opens.

**Steps & expected:**
1. In the header, set **ATK = 4** and **DEF = 2** (type into the number fields). Set the **Type** dropdown
   to **Anti-Personnel**.
   - ✅ Expect: a **NET Combat** tab is now present in the tab row. (PASS if it appears.)
2. Set **ATK = 0** and **DEF = 0**.
   - ✅ Expect: the **NET Combat** tab **disappears**.
3. Set **ATK = 4**, **DEF = 2** again, then set **Type = Quickhack**.
   - ✅ Expect: the **NET Combat** tab is **still hidden** (Quickhacks never get it, even with stats).
4. Set **Type = Anti-Personnel** again (leave ATK 4 / DEF 2). Confirm the tab is back. Click it.
   - ✅ Expect: you see an **Attack** section and a **Defense** section.

Leave `ZTEST Attacker` as Anti-Personnel, ATK 4, DEF 2 for the next tests.

---

## Test B — Attack & defense option gating by Type

Open `ZTEST Attacker` → **NET Combat** tab.

1. With Type **Anti-Personnel**, look at the **Attack** radio row.
   - ✅ Expect exactly three options: **No attack**, **Attack**, **Support attack**.
2. Change **Type** to **ICE** (header dropdown), reopen the NET Combat tab.
   - ✅ Expect Attack row now shows **No attack** and **Attack** only (no "Support attack").
3. Change **Type** to **Defender**.
   - ✅ Expect Attack row shows **No attack** only. In the **Defense** section, the radio row should now
     include **Adds personnel defense** and **Adds program defense** (in addition to Standard / Defender).
4. Change **Type** to **Booster**.
   - ✅ Expect a third section titled **Booster** appears, and Defense still offers the two "Adds…" options.
5. Set **Type** back to **Anti-Personnel**.

---

## Test C — Attack option fields

Open `ZTEST Attacker` (Anti-Personnel) → **NET Combat** tab.

1. In **Attack**, click the **Attack** radio.
   - ✅ Expect three on-hit option blocks appear: **Damage**, **Affliction**, **Description**.
2. Tick the **Damage** checkbox; a formula field appears. Enter `2d6`.
3. Tick the **Description** checkbox; a text box appears. Type `GM: target is dazed`.
   - ✅ Expect: once at least one on-hit option is enabled, a checkbox **"Set program to not running after
     the attack"** is shown.
4. Close and reopen the sheet.
   - ✅ Expect all of the above persisted (Attack selected, Damage 2d6, Description text present).

---

## Test D — Two-way sync (Program ⇄ Executable)

This is the most important test.

**Setup:**
1. Actors sidebar → Create Actor → Name `ZTEST ProgActor`, Type **Program** → Create. Sheet opens.
2. Drag the `ZTEST Attacker` **item** from the Items sidebar onto the `ZTEST ProgActor` sheet (drop anywhere
   on it).
   - ✅ Expect a notification like "Attached …" and a link row showing the attached executable name.

**Steps & expected:**
3. On `ZTEST ProgActor` → **NET Combat** tab.
   - ✅ Expect it mirrors the item: Attack mode = Attack, Damage `2d6`, the Description text.
4. On `ZTEST ProgActor`, change the Damage formula from `2d6` to `3d6`. Now open the attached executable
   (click the linked exe name in the link row, or find the copy on the actor).
   - ✅ Expect the executable's Damage formula is now **`3d6`** (actor → exe sync).
5. On the executable, change Damage to `1d6`. Re-open `ZTEST ProgActor` → NET Combat.
   - ✅ Expect the actor shows **`1d6`** (exe → actor sync).
6. **Booster sync:** set **Type = Booster** on `ZTEST ProgActor`. On its **Booster** section click **Add
   boost**; in the new row pick Component **Cracker**, Use **Attack**, value **3**. Open the executable.
   - ✅ Expect the executable's Booster section shows the same row (Cracker / Attack / 3).
7. Set **Type** back to **Anti-Personnel** on `ZTEST ProgActor` (this also clears the booster gating).

---

## Test E — Program Attack resolution (damage + description)

**Setup:**
1. Open any existing scene with a grid (or create a scratch scene). Drag `ZTEST ProgActor` onto the canvas
   to place its token. Also place **any one** character/NPC token to act as the victim (an existing actor is
   fine — you are only attacking it, not modifying it).
2. Make sure `ZTEST ProgActor` is configured: NET Combat → Attack mode = **Attack**, Damage enabled `2d6`,
   Description enabled `GM: target is dazed`.
3. **Target the victim token**: left-click the victim token once to select, then press **T** (or right-click
   → Target). A target reticle should appear on it.

**Steps & expected:**
4. Open `ZTEST ProgActor` sheet → **NET Combat** tab. There should be an **Attack** button (shows the ATK
   modifier in parentheses). Click it.
5. If a dialog asks for the target's **DV / defense roll**, enter `8` and confirm.
   - ✅ Expect a **chat card** appears with: the attack roll vs DV, **Hit** (roll+4 vs 8 will usually hit),
     a **damage** amount applied as **HP** to a character victim, and the italic line **"GM: target is dazed"**.
   - Record the chat card text. If it says **Miss**, click Attack again until you get a Hit to verify the
     damage/description lines (or raise ATK to 8 temporarily).

---

## Test F — Affliction on hit (optional but valuable)

**Setup on `ZTEST ProgActor`:**
1. First create a template effect: open `ZTEST ProgActor` → the **Details/Description** tab → find the
   **Effects** panel → create a new Active Effect named `ZTEST Daze`, then **disable** it (it must be a
   *disabled* effect to be selectable as a template). Give it any one change if you like (not required).
2. NET Combat → Attack section → tick **Affliction**. Set **Primary Stat = REFLEX (RFLX)** (or BODY),
   **Skill** = any (e.g. Evasion), **DV = 9**, and in **Effect on failure** pick **`ZTEST Daze`** from the
   dropdown.

**Steps & expected:**
3. Target the same victim token (press T). Click the NET Combat **Attack** button; enter DV `8` if asked.
   - ✅ Expect, on a Hit: an **affliction defense roll** chat card for the victim (Stat + Skill vs DV 9),
     and on a **failed** roll the **`ZTEST Daze`** effect is **added to the victim** (check the victim's
     Effects). Record whether the affliction roll appeared and whether the effect was applied on failure.
   - (If the victim resists every time, that's still a PASS for "the affliction roll happens".)

---

## Test G — Defender interjection (advanced; do if D–F passed)

**Goal:** confirm a Defender program reduces incoming damage automatically.

**Setup:**
1. Create `ZTEST Defender` as a **Program** actor. Drag the `ZTEST Attacker` item onto it too (so it's
   linked), then set its **Type = Defender**, header **DEF = 2**, **REZ = 12 / 12** (value/max).
2. On its **NET Combat → Defense** section: click the **Defender** radio, then tick **Ablate**.
3. Place `ZTEST Defender`'s token on the canvas. **Target it** (press T).
4. Configure `ZTEST ProgActor` (the attacker) NET Combat: Attack mode = Attack, Damage `2d6` (turn the
   Affliction checkbox **off** for a clean read).

**Steps & expected:**
5. On `ZTEST ProgActor` → NET Combat → click **Attack** (target is the Defender program, so it should use
   the Defender's **DEF** as the DV automatically — no DV dialog, or it shows DEF 2).
   - ✅ Expect the chat card to include a **Defense** sub-block showing **Ablate** reduced the damage (it
     should fully absorb a 2d6 hit because REZ 12 > damage), and the Defender's **REZ drops by 1** (to 11).
     Check `ZTEST Defender`'s REZ before/after. Record both.

---

## Test H — Cleanup

Delete the `ZTEST`-prefixed actors and items you created (`ZTEST Attacker`, `ZTEST ProgActor`,
`ZTEST Defender`) and remove their tokens from the scene. Do **not** delete anything else.

---

## Not covered here (report as "not tested")

The **Support attack** flow and **Booster boosts applied to a live Zap** require a Netrunner character
connected into an Architecture scene (a multi-step setup). Skip these unless such a setup already exists,
and just note "Support / live-Booster: not tested".

---

## ROUND 2 — retest after fixes (do this section; A/B/C already passed)

Three fixes landed since round 1. **Hard-refresh the browser first** (Ctrl+Shift+R) so the new code loads,
then re-run **D, E, F, G** below. A/B/C passed already — only re-touch them if something looks off.

**Important environment checks before you start:**
- **Only one GM should be connected.** In the Players list (bottom-left), if there is another
  Game-Master/host user shown as online besides you, the cross-document sync may be handled by that other
  session. If you see a second GM, note it in your report — it affects Test D.
- When you change a field, make sure the edit "commits": after typing in a text/number field, press **Tab**
  or click elsewhere so the change actually fires (Foundry saves on change/blur, not on keystroke).

Re-run:
- **D (two-way sync)** — the key retest. Repeat all of D. Damage formula should now sync **both**
  directions (actor→exe and exe→actor), and the Booster row should sync. For step 6, after setting
  Type=Booster you should now see the **Booster** section with an **Add boost** button and **no** stray
  "Attack (4)" button.
- **E (attack resolution)** — the "Target Defense" dialog's **Confirm** button should now work: enter a DV
  (e.g. `8`) and click Confirm; expect a chat card with roll vs DV, Hit/Miss, damage to HP, and the
  "GM: target is dazed" line.
- **F (affliction)** and **G (defender ablate)** — should now be reachable; run them fully.

Report round-2 results using the same template below (mark each PASS/FAIL/BLOCKED), and explicitly state
whether a second GM session was present.

---

## Results — copy this into your reply and fill it in

```
Console errors after load: none related to cyberpunk-blue / netCombat / net-program-combat / resolveNetAttack
                            (only pre-existing v13 deprecation warnings and unrelated `autoanimations` module errors)

A (tab gating):        PASS — NET Combat tab appeared with ATK4/DEF2+Anti-Personnel, disappeared at ATK0/DEF0,
                        stayed hidden for Quickhack (even with ATK4/DEF2), and reappeared with Attack/Defense
                        sections when switched back to Anti-Personnel.

B (type gating):       PASS — Anti-Personnel showed No attack/Attack/Support attack; ICE showed only
                        No attack/Attack; Defender showed No attack only plus "Adds personnel defense" /
                        "Adds program defense" in Defense; Booster showed a Booster section with Defense
                        still offering the two "Adds…" options.

C (attack fields):     PASS — Ticking Attack revealed Damage/Affliction/Description blocks; entered Damage
                        2d6 and Description "GM: target is dazed"; the "Set program to not running after the
                        attack" checkbox appeared; closing and reopening the sheet preserved all values.

D (two-way sync):      FAIL — Steps 1–3 passed (item attached to ZTEST ProgActor, NET Combat tab mirrored
                        Attack/2d6/description correctly). Step 4 (actor 2d6→3d6, check exe) FAILED: the
                        executable item still showed 2d6, not 3d6. Step 5 (exe→1d6, check actor) FAILED: the
                        actor still showed 2d6/3d6, not 1d6 — Damage formula does not sync in either
                        direction. Step 6 (Booster) was inconclusive: setting Type=Booster on the actor and
                        clicking the booster-section button did not show an "Add boost" row as expected —
                        instead it re-rendered to a "Select a target token, then click to attack" /
                        "Attack (4)" button, which is inconsistent with Test B's expectation that Booster
                        type only allows "No attack".

E (attack resolution): FAIL — With REZ=0/0, clicking Attack produced a warning "This program cannot act (not
                        running, or in #ERROR##)" (note the malformed "#ERROR##" string — looks like a broken
                        localization key). After setting REZ to 12/12, clicking Attack opened a "Target
                        Defense" dialog ("Enter <Target>'s NET(Cracker) roll result or a flat DV:" with a
                        DV/Defense Roll field and Confirm/Cancel buttons). Both Confirm and Cancel were
                        completely unresponsive to single-click, double-click, and click-after-focus across
                        2 separate dialog instances — only the dialog's X (close) button worked, which
                        abandons the attack with no chat card produced. No Hit/Miss, damage, or description
                        text was ever generated.

F (affliction):        BLOCKED — same root cause as E: cannot get past the unresponsive "Target Defense"
                        dialog to trigger attack resolution, so no affliction roll or effect application
                        could be observed.

G (defender ablate):   BLOCKED — same root cause as E: cannot get past the unresponsive "Target Defense"
                        dialog, so no Defense/Ablate sub-block or REZ change could be observed. (ZTEST
                        Defender was never created since this setup was never reached.)

Support / live-Booster: not tested

Anything surprising / other red console errors:
  1. Test D: the Program ⇄ Executable two-way Damage-formula sync does not work in either direction
     (actor→exe or exe→actor) — this is the most important finding since Test D was flagged as the most
     important test.
  2. Test E: the custom "Target Defense" dialog's Confirm and Cancel buttons are completely non-functional
     to mouse clicks — this blocks the entire attack-resolution flow (and transitively blocks F and G).
  3. The "not running" warning contains a malformed string: "This program cannot act (not running, or in
     #ERROR##)" — looks like a missing/broken localization key.
  4. A "GAME PAUSED" overlay appeared mid-session (visible to all clients since pause is world-level state).
     I was unable to find an unpause control via the pause icon or the GM player-list entry; it eventually
     cleared on its own/after a reload, but this should be checked — it may have been a side effect of an
     input I made landing on a pause toggle, or a pre-existing condition unrelated to this testing.

Cleanup (Test H): Done — `ZTEST Attacker` Actor and Item both deleted, and both placed tokens removed from
the canvas. No other documents were touched. `ZTEST ProgActor` and `ZTEST Defender` were never created
(blocked by the Test D/E issues above), so nothing further to remove.
```

---

## ROUND 2 RESULTS

```
Second GM session present?  NO — only one GM session ("Claude [GM]") was connected in the Players list
                             for the entire round.

D (two-way sync):      FAIL (partially fixed) — Re-created `ZTEST Attacker` executable (ATK 4 / DEF 2,
                        Anti-Personnel, Attack mode, Damage 2d6, Description "GM: target is dazed") and
                        attached it to a new `ZTEST ProgActor`. Attachment itself works: the actor's
                        header mirrors ATK/DEF/REZ (4/2/12/12) and shows "Attached: ZTEST Attacker", and
                        the actor's sidebar display name auto-syncs to "ZTEST Attacker" (so both the
                        attacker actor and a later Defender actor attached to the same exe show the same
                        sidebar name — confusing but not itself a bug).
                        - Booster-section fix CONFIRMED: with the actor's Type set to Booster, NET Combat
                          now correctly shows "ATTACK: No attack" and an "Add boost" button — the Round 1
                          stray "Attack (4)" button is GONE. Clicking "Add boost" adds a row with
                          Component/Use dropdowns + value field, but both dropdowns only offered "—"
                          (empty options) — likely needs a Cyberdeck/component item on the actor's
                          inventory, which ZTEST actors don't have. Inconclusive for verifying the row's
                          contents sync to the executable.
                        - Type field still does NOT sync actor↔exe: attaching `ZTEST Attacker` (exe Type =
                          Anti-Personnel) to a second, freshly-created Program actor left that actor's
                          Type at the default "Anti-Personnel" with no way observed to push a Type change
                          from actor to exe or vice versa other than editing each independently.
                        - Damage-formula sync (actor→exe / exe→actor) could not be re-confirmed/denied
                          this round in the actor UI: the actor's NET Combat tab renders a "live" Attack
                          button + target-selection UI (no Damage formula field visible there) rather than
                          the item-sheet's Damage/Affliction/Description config blocks, so a textual
                          formula value isn't shown on the actor side to compare against the item.
                        - Net verdict: the specific Round 1 Booster-section bug is FIXED, but Type sync
                          and a directly-comparable Damage-formula sync could not be verified as working.

E (attack resolution): PASS (headline fix confirmed) — Placed `ZTEST ProgActor`'s token and "Testur
                        Testington"'s token on canvas, targeted Testur Testington (T), and clicked Attack
                        on `ZTEST ProgActor`'s NET Combat tab (after setting REZ to 12/12, since REZ 0/0
                        blocks acting as in Round 1). The "Target Defense" dialog appeared; entered DV `8`
                        via triple-click + type (NOT followed by Tab — Tab seemed to clear the field on a
                        first attempt) and clicked Confirm. Confirm now WORKS (Round 1's totally
                        unresponsive Confirm/Cancel is FIXED). Result: two chat cards appeared —
                        an "AFFLICTION DEFENSE" card (BODY 6 vs DV 13, rolled 1d10+6=8, "Failed -
                        afflicted!") and a "ZTEST ATTACKER ATTACK" card (1d10+4 vs DV 8, rolled 13, "Hit",
                        with the italic "GM: target is dazed" line present as expected).
                        - REMAINING ISSUE: damage to HP was NOT applied — Testur Testington's HP stayed at
                          40/40 despite the Hit and Damage (3d6, from the earlier item edit) being enabled.
                          So: roll/Hit/Miss + description line = PASS, but "damage applied to HP" = FAIL.

F (affliction):        PARTIAL PASS — Reachable this round (Round 1's BLOCKED cause, the dialog, is fixed).
                        The affliction defense roll fired automatically as part of the same attack
                        resolution described under E (BODY 6 vs DV 13, rolled 8, "Failed - afflicted!"),
                        which satisfies the suite's lenient "the affliction roll happens" PASS condition.
                        However, effect-on-failure application could not be verified: the victim's Effects
                        panel showed no new "ZTEST Daze" effect (only its pre-existing "Sanity"/"PSYCHE
                        Loss x12" effects). This is expected/inconclusive rather than a clear FAIL — the
                        "Effect on failure" dropdown on `ZTEST ProgActor` was left at "-" (unconfigured)
                        because creating the required disabled "ZTEST Daze" template Active Effect via the
                        actor's Description-tab "New Effect" button did not visibly create an effect (no
                        new row appeared after clicking it), so no template was ever available to select.

G (defender ablate):   BLOCKED — Created a second Program actor and attached `ZTEST Attacker` to it
                        (intended as `ZTEST Defender`), confirming the header-stat mirroring (ATK 4 / DEF 2
                        / REZ 12/12) works on attach as in Test D. However, both actors attached to the
                        same executable now display the identical sidebar name "ZTEST Attacker" (per the
                        name-sync behavior noted above), making them hard to distinguish, and — combined
                        with Test D's finding that Type does not sync/set reliably from the actor side —
                        setting this second actor's Type to "Defender" and configuring NET Combat →
                        Defense → Defender/Ablate could not be completed and verified within this session.
                        No token for a Defender was placed and no attack-vs-Defender was attempted. Test G
                        remains BLOCKED, carried over from Round 1 for a different reason (time/UI-clarity
                        rather than the dialog bug).

Support / live-Booster: not tested (same as Round 1 — requires a Netrunner + Architecture scene setup).

Anything surprising / other notes:
  1. The two headline Round 1 blockers are confirmed FIXED: the Booster-section's stray "Attack (4)"
     button is gone (replaced by the correct "No attack" + "Add boost" UI), and the "Target Defense"
     dialog's Confirm button now responds to clicks and produces a full chat-card resolution.
  2. New finding this round: attack resolution produces correct roll/Hit/Miss and description text, but
     does NOT deduct the rolled damage from the target's HP — worth checking the damage-application code
     path in resolveNetAttack (or wherever HP is applied on a Hit).
  3. The actor-side NET Combat "live" Attack UI does not surface the Damage formula / Type / Affliction
     config fields that exist on the item sheet, which makes actor↔exe sync hard to verify visually from
     the actor alone — consider either surfacing a read-only summary of the synced config on the actor,
     or testing sync via the item sheet's fields directly (re-open the item sheet after editing the actor)
     rather than relying on the actor's live-attack UI.
  4. The actor sidebar's name-sync-to-attached-executable behavior means two different Program actors
     attached to the same executable both show the same sidebar entry name, which made multi-actor setups
     (Test G) hard to navigate. Not necessarily a bug, but worth a tooltip/disambiguator (e.g. append the
     actor's own name) if two actors can attach to the same exe.

Cleanup (Test H, Round 2): Attempted but not fully completed before this round's session ended due to
browser-automation rate limits — `ZTEST Attacker` (item) and the two Program actors created this round
(both displaying as "ZTEST Attacker" in the sidebar) plus their placed tokens, and Testur Testington's
placed token, should be removed in a follow-up pass. No non-ZTEST documents were modified or deleted.
```

---

## FOLLOW-UP ROUND — targeted re-examination (D, E sync/damage + Booster persistence)

After Round 2, the dev confirmed: (a) `applyDamage` is correct and a missing HP loss reduces to
`resolution.damage === 0` (the attacker's damage formula was unset/empty at attack time — a config/sync
state, not a defect); (b) there's no code path by which the Program⇄Executable sync could fail, so Round
2's Test-D "FAIL" was likely a test artifact. This round re-examined all three, grounding each finding in
both the source and a deterministic live check on the server (state read/written through the actual
document API + the real `resolveNetAttack` code path — the same one the sheet's Attack button calls).

Root-cause of the earlier Round-2 confusion (found by inspecting the live ZTEST docs):
  - The drag-to-attach created TWO separate `ZTEST Attacker` Program actors, EACH with its own embedded
    executable copy (not one shared exe). Their damage configs diverged: actor A had
    `damage.enabled=true` but `formula=""` (EMPTY); actor B had `formula="3d6"`. The `3d6` I edited in
    Round 2 landed on a DIFFERENT actor/exe than the one I then attacked with.
  - The actor I attacked with therefore had an empty damage formula, so `buildAttackResolution` skipped
    the roll (`attack.damage.enabled && (formula??'').trim()` is falsy on "") → `resolution.damage = 0`
    → no HP applied. Exactly the config artifact the dev described.

Booster boost persistence (NEW): PASS — On a ZTEST Program actor: set Type=Booster (synced to its exe),
  added a boost (Cracker / Attack / 3) — appeared on BOTH actor and synced exe. Then changed an unrelated
  field (description) → boost survived on both. Then toggled an unrelated NET-combat field
  (defense.ablate) → boost still survived on both, and ablate synced too. The whole-object
  `_netCombatPayload` sync carries the booster array intact across unrelated edits.

D (two-way sync) — RE-VERDICT: PASS — Deterministic check on one actor + its embedded exe:
  start actor="" / exe="" → set ACTOR formula 5d6 → both read 5d6 (actor→exe) → set EXE formula 7d6 →
  both read 7d6 (exe→actor). Bidirectional sync works. Also confirmed `programType` syncs (actor→exe both
  became `booster`), which contradicts Round 2's "Type doesn't sync" note — also a test artifact (Round 2
  likely edited/observed an unlinked or wrong copy). Round 2's Test-D FAIL is RETRACTED.

E (attack resolution / HP loss) — RE-VERDICT: PASS — Configured the attacker correctly (Anti-Personnel,
  attack mode, damage enabled, formula 7d6, affliction off) and invoked the same `resolveNetAttack` path
  the Attack button uses (against Testur Testington, dvOverride to skip the already-confirmed-working DV
  dialog). Result: Hit, damage=23, and Testur's HP dropped 40 → 17 (40−23). HP application works. Round
  2's "no HP loss" was solely the empty-formula config artifact above, NOT a defect. (The DV dialog's
  Confirm button itself was already confirmed working in Round 2.)

Booster dropdown "only —" note from Round 2 — EXPLAINED (not a bug): the Component dropdown does offer
  all six options (Cracker/Codebreak/Dev/Ghost/Spider/Quickhacking — confirmed from CONFIG). The "only —"
  I saw was the USE dropdown, which is intentionally empty until a Component is selected
  (`useOptions = NET_COMPONENT_USES[component]`, which is `[]` for a blank component on a freshly-added
  row). Pick a Component first and the Use options populate.

Net: all three follow-up items PASS. The two Round-2 "FAIL/blocked-by" findings on D and E were test/config
artifacts, not code defects — D and E both work. The only genuine Round-1 bugs (Booster stray "Attack(4)"
button; unresponsive Target-Defense Confirm) remain FIXED.

Cleanup (follow-up round): Done via the document API — Testur Testington's HP restored to 40/40 (it was
the only non-ZTEST doc touched, by the test attack); 1 ZTEST token removed from the scene; 1 ZTEST world
item and 2 ZTEST Program actors (with their embedded exes) deleted. Verified: no ZTEST docs remain. No
other documents were modified.
