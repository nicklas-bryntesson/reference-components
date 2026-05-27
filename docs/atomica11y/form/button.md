How to test a button

GIVEN THAT I am on a page with a button

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a button I SEE focus is strongly visually indicated
- THEN when I use the spacebar and/or enter key to activate the button I SEE the intended action occurs

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a button
  - I HEAR Its purpose is clear
  - I HEAR It identifies its role of button
  - I HEAR It expresses its state if applicable (expanded / collapsed, pressed, disabled / dimmed / unavailable)
- THEN when I use the spacebar and/or enter key to activate the button I HEAR the intended action occurs

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a button
  - I HEAR Its purpose is clear
  - I HEAR It identifies its role of button
  - I HEAR It expresses its state if applicable (expanded / collapsed, pressed, disabled / dimmed / unavailable)
- THEN when I doubletap with the button in focus I HEAR the intended action occurs

4 - Device settings
- WHEN I use custom font settings THEN I see text resizes up to 200% without losing information

Full information: https://www.atomica11y.com/accessible-web/button/
