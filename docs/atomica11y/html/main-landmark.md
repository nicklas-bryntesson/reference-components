How to test a main landmark

GIVEN THAT I am on a page with a main landmark

1 - Keyboard for mobile & desktop browser

- THEN when I use the tab key to move focus to a control in the main I SEE focus moves to the control (but the landmark itself does not receive focus)

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use landmark shortcuts
  - I HEAR it is discoverable as a main landmark
  - I HEAR it has no name, only a role because there should be only one
- THEN when I use the tab key to move focus to a control in the main I HEAR focus moves to the control (but the landmark itself does not receive focus)

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I use screen reader shortcuts 
  - I HEAR it is discoverable as a main landmark
  - I HEAR it has no name, only a role because there should be only one
- OR WHEN when I swipe to move focus to a control in the landmark I HEAR focus moves to the control (but the landmark itself does not receive focus)

Full information: https://www.atomica11y.com/accessible-web/main/
