How to test a chat

GIVEN THAT I am on a page with a chat

1 - Keyboard for mobile & desktop browser
- WHEN I use the arrow key to browse to the chat I SEE the chat scrolls into view
- THEN when I use the tab key I SEE individual controls are focusable in meaningful order (but not the chat itself)
- WHEN when I use the chat I SEE notifications when a new message is received

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the arrow key to browse to the chat
  - I HEAR the chat purpose is clear
  - I HEAR controls in the chat use appropriate roles like button, text field, etc.
  - I HEAR status changes (Ex: User is typing…) are announced
  - I HEAR chat is intuitive to discover, open, close
- THEN when I use the tab key I HEAR individual controls are focusable in meaningful order (but not the chat itself)

- WHEN when I use the chat I HEAR notifications when a new message is received

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to browse to a chat
  - I HEAR the chat purpose is clear
  - I HEAR controls in the chat use appropriate roles like button, text field, etc.
  - I HEAR status changes (Ex: User is typing…) are announced
  - I HEAR chat is intuitive to discover, open, close
- WHEN when I use the chat I HEAR notifications when a new message is received

4 - Device settings
- WHEN I use custom font settings THEN I see text resizes up to 200% without losing information

Full information: https://www.atomica11y.com/accessible-web/chat/
