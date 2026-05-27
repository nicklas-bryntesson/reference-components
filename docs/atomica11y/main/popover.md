How to test a popover

GIVEN THAT I am on a page with a popover

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a popover button I SEE focus is strongly visually indicated
- THEN when I use the spacebar and/or enter key to activate a popover button I SEE the popover surface expands/collapses
- THEN when I use the tab key to move focus to a control in the popover I SEE each option is focused
- OR when I use the tab key to move focus out of the popover I SEE focus leaves the popover, I am not trapped in the popover

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a popover button
  - I HEAR its purpose is clear
  - I HEAR the popover button identifies its role as button
  - I HEAR popover button expresses its state (expanded/collapsed)
- THEN when I use the spacebar and/or enter key to activate a popover button I HEAR the popover surface expands/collapses

- THEN when I use the tab key to move focus to a control in the popover I HEAR each option is focused

- OR when I use the tab key to move focus out of the popover I HEAR focus leaves the popover, I am not trapped in the popover

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a popover button
  - I HEAR its purpose is clear
  - I HEAR the popover button identifies its role as button
  - I HEAR popover button expresses its state (expanded/collapsed)
- THEN when I doubletap with the button in focus I HEAR the popover expands/collapses

Full information: https://www.atomica11y.com/accessible-web/popover/
