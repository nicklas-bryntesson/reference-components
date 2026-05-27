How to test a dialog modal

GIVEN THAT I am on a page with a dialog modal

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to the launch button and use spacebar and/or enter key to activate the button I SEE the dialog opens
- THEN when I use the arrow keys I SEE content is browsed in meaningful order, content behind the dialog remains inert
- THEN when I use the tab key I SEE focus moves to interactive controls in the dialog, content behind the dialog remains inert
- THEN when I use the escape key I SEE focus returns to the launch button
- OR when I use the tab key to move focus to the dismiss/close button AND THEN use the spacebar or enter key to activate the dismiss/close button I SEE focus returns to the launch button

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to the launch button and use spacebar and/or enter key to activate the button
  - I HEAR The dialog describes its purpose or title on launch
  - I HEAR It identifies itself as a dialog
  - I HEAR When closed, focus returns to the launch button
  - I HEAR When open, content behind the dialog remains inert
- THEN when I use the arrow keys I HEAR content is browsed in meaningful order, content behind the dialog remains inert

- THEN when I use the tab key I HEAR focus moves to interactive controls in the dialog, content behind the dialog remains inert

- THEN when I use the escape key I HEAR focus returns to the launch button

- OR when I use the tab key to move focus to the dismiss/close button AND THEN use the spacebar or enter key to activate the dismiss/close button I HEAR focus returns to the launch button

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to focus to the launch button
  - I HEAR The dialog describes its purpose or title on launch
  - I HEAR It identifies itself as a dialog
  - I HEAR When closed, focus returns to the launch button
  - I HEAR When open, content behind the dialog remains inert
- THEN when I doubletap with the button in focus I HEAR the dialog opens
- THEN when I swipe within the dialog I HEAR focus stays trapped in the dialog
- THEN when I swipe to move focus to the dismiss/close button AND THEN double tap on the close button I HEAR focus returns to the launch button

Full information: https://www.atomica11y.com/accessible-web/dialog-modal/
