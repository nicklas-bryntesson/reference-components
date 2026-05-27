How to test a card box

GIVEN THAT I am on a page with a card box

1 - Keyboard for mobile & desktop browser
- WHEN I use the arrow key to browse to a card I SEE the card scrolls into view
- WHEN when I use the tab key I SEE individual controls are focusable (but not the card itself)

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the arrow key to browse to a card
  - I HEAR the card's purpose is clear from its heading
  - I HEAR the card itself has no role, only the content inside
- WHEN when I use the tab key I HEAR individual controls are focusable (but not the card itself)

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to browse to a card
  - I HEAR the card's purpose is clear from its heading
  - I HEAR the card itself has no role, only the content inside

Full information: https://www.atomica11y.com/accessible-web/card/
