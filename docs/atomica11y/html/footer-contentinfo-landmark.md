How to test a footer / contentinfo landmark

GIVEN THAT I am on a page with a footer / contentinfo landmark

1 - Keyboard for mobile & desktop browser

- WHEN when I use the tab key to move focus to a control in the footer I SEE focus moves to the control (but the footer landmark itself does not receive focus)

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use landmark shortcuts
  - I HEAR it is discoverable as a contentinfo or footer landmark
  - I HEAR it has no name, only a role because there should be only one
- WHEN when I use the tab key to move focus to a control in the footer I HEAR focus moves to the control (but the footer landmark itself does not receive focus)

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I use screen reader shortcuts 
  - I HEAR it is discoverable as a contentinfo or footer landmark
  - I HEAR it has no name, only a role because there should be only one
- OR WHEN when I swipe to move focus to a control in the footer I HEAR focus moves to the control (but the footer itself does not receive focus)

Full information: https://www.atomica11y.com/accessible-web/footer/
