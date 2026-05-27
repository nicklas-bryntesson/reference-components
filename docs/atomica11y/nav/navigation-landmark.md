How to test a navigation landmark

GIVEN THAT I am on a page with a navigation landmark

1 - Keyboard for mobile & desktop browser

- WHEN when I use the tab key to move focus to a control in the navigation I SEE focus moves to the control (but the navigation landmark itself does not receive focus)

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use landmark shortcuts
  - I HEAR it is discoverable as a navigation landmark
  - I HEAR if there are multiple navigations present, its purpose is unique and clear
- WHEN when I use the tab key to move focus to a control in the navigation I HEAR focus moves to the control (but the navigation landmark itself does not receive focus)

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I use screen reader shortcuts 
  - I HEAR it is discoverable as a navigation landmark
  - I HEAR if there are multiple navigations present, its purpose is unique and clear
- OR WHEN when I swipe to move focus to a control in the navigation I HEAR focus moves to the control (but the navigation itself does not receive focus)

Full information: https://www.atomica11y.com/accessible-web/nav/
