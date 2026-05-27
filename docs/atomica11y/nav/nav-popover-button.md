How to test a nav popover button

GIVEN THAT I am on a page with a nav popover button

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a menu button I SEE focus is strongly visually indicated
- THEN when I use the spacebar and/or enter key to activate a menu button I SEE the menu expands/collapses
- THEN when I use the tab key to move focus to a menu option I SEE each option is focused
- OR when I use the tab key to move focus to the end of the options I SEE focus leaves the menu, I am not trapped in the menu

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a menu button
  - I HEAR its purpose is clear
  - I HEAR the menu button identifies its role as button, each option identifies its role as link
  - I HEAR menu button expresses its state (expanded/collapsed)
- THEN when I use the spacebar and/or enter key to activate a menu button I HEAR the menu expands/collapses

- THEN when I use the tab key to move focus to a menu option I HEAR each option is focused

- OR when I use the tab key to move focus to the end of the options I HEAR focus leaves the menu, I am not trapped in the menu

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a menu button
  - I HEAR its purpose is clear
  - I HEAR the menu button identifies its role as button, each option identifies its role as link
  - I HEAR menu button expresses its state (expanded/collapsed)
- THEN when I doubletap with the button in focus I HEAR the menu expands/collapses

Full information: https://www.atomica11y.com/accessible-web/nav-popover/
