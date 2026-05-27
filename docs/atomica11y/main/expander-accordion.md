How to test an expander accordion

GIVEN THAT I am on a page with an expander accordion

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to an expander I SEE focus is strongly visually indicated
- THEN when I use the spacebar and/or enter key to activate the expander I SEE the hidden content is revealed

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to an expander
  - I HEAR Its purpose is clear
  - I HEAR It identifies its role of button or summary
  - I HEAR It expresses its state (expanded/collapsed)
- THEN when I use the spacebar and/or enter key to activate the expander I HEAR the hidden content is revealed

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a button
  - I HEAR Its purpose is clear
  - I HEAR It identifies its role of button or summary
  - I HEAR It expresses its state (expanded/collapsed)
- THEN when I doubletap with the button in focus I HEAR the intended action occurs

4 - Device settings
- WHEN I use custom font settings THEN I see text resizes up to 200% without losing information
- WHEN I use magnification or pinch-to-zoom THEN I see expand/collapse indicator is in visual proximity to text label

Full information: https://www.atomica11y.com/accessible-web/expander/
