# Private result label placement

## Goal

Players need to understand that the private result text in the previous turn result was visible only to their House. Today that text appears after the result image, which makes it feel secondary and disconnected from the private-message context.

## Design

In the player game page, inside the "Resultado anterior" card:

1. Keep the public result text first.
2. If a private result exists, show a clearly titled block before the result image.
3. The block title is **Informação Privada**.
4. Keep the private text visually quieter than the public text, following the existing secondary-text style.
5. Keep the result image below the private block.

This change applies only to `previousResult.privateResult`. The current turn's private-information card remains unchanged.

## Data flow

No API or data model change is needed. The existing `game.previousResult.privateResult` value is rendered in a different position in `GamePage`.

## Testing

Add a UI regression test for `GamePage` that renders a previous result with a private result and result image, then asserts the order:

1. Public result text.
2. "Informação Privada" heading.
3. Private result text.
4. Result image.

## Deployment

This is a frontend-only rendering change. After tests pass, commit, push to `main`, and rely on the existing GitHub/Amplify deployment flow.
