How to test a number input

GIVEN THAT I am on a page with a number input

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a number input I SEE focus is strongly visually indicated
- THEN when I use the number keys I SEE numbers are entered
- THEN when I use non-number keys I SEE nothing is entered

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a number input
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as an editable input
  - I HEAR Hints or errors are read after the label, related inputs include a group name (Ex: Enter your personal information)
  - I HEAR If applicable, it expresses its state (required, disabled / dimmed / unavailable)
- THEN when I use the number keys I HEAR numbers are entered

- THEN when I use non-number keys I HEAR nothing is entered

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a number input
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as an editable input
  - I HEAR Hints or errors are read after the label, related inputs include a group name (Ex: Enter your personal information)
  - I HEAR If applicable, it expresses its state (required, disabled / dimmed / unavailable)
- THEN when I enter a number I HEAR the numeric keypad is revealed

Full information: https://www.atomica11y.com/accessible-web/input-number/
