How to test a dialog alert

GIVEN THAT I am on a page with a dialog alert

1 - Keyboard for mobile & desktop browser
- WHEN I use an action that triggers an alert dialog I SEE the dialog opens
- THEN when I use the arrow keys I SEE content in the dialog is browsed in meaningful order and does not leave the dialog
- THEN when I use the tab key I SEE focus moves to interactive controls inside the dialog

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use an action that triggers an alert dialog
  - I HEAR the dialog describes its purpose or title on launch
  - I HEAR it identifies itself as a dialog
  - I HEAR when closed, focus returns to a meaningful place
  - I HEAR when open, content behind the modal remains inert
- THEN when I use the arrow keys I HEAR content in the dialog is browsed in meaningful order and does not leave the dialog

- THEN when I use the tab key I HEAR focus moves to interactive controls inside the dialog

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I perform an action that triggers an alert dialog
  - I HEAR the dialog describes its purpose or title on launch
  - I HEAR it identifies itself as a dialog
  - I HEAR when closed, focus returns to a meaningful place
  - I HEAR when open, content behind the modal remains inert
- THEN when I doubletap with the button in focus I HEAR the dialog opens
- THEN when I swipe within the dialog I HEAR focus stays trapped in the dialog

Full information: https://www.atomica11y.com/accessible-web/dialog-alert/
