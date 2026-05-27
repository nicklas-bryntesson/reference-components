How to test a text input

GIVEN THAT I am on a page with a text input

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a text input I SEE focus is strongly visually indicated

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a text input
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a text input
  - I HEAR Hints or errors are read after the label, related inputs include a group name (Ex: Enter your personal information)
  - I HEAR If applicable, it expresses its state (required, disabled / dimmed / unavailable)
3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus on a text input
  - I HEAR Its purpose is clear
  - I HEAR It identifies itself as a text input
  - I HEAR Hints or errors are read after the label, related inputs include a group name (Ex: Enter your personal information)
  - I HEAR If applicable, it expresses its state (required, disabled / dimmed / unavailable)

Full information: https://www.atomica11y.com/accessible-web/input-text/
