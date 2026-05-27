How to test a link

GIVEN THAT I am on a page with a link

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a link I SEE focus is strongly visually indicated
- THEN when I use the enter key to activate the link I SEE my browser goes somewhere

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a link
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a link
- THEN when I use the enter key to activate the link I HEAR my browser goes somewhere

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a link
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a link
- THEN when I doubletap with the link in focus I HEAR my browser goes somewhere

Full information: https://www.atomica11y.com/accessible-web/link/
