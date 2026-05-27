How to test a video/audio player

GIVEN THAT I am on a page with a video/audio player

1 - Keyboard for mobile & desktop browser
- WHEN I use the tab key to move focus to a control I SEE focus is strongly visually indicated
- THEN when I use the spacebar and/or enter key to activate the button I SEE the intended action occurs
- THEN when I use the arrow keys (left/right) I SEE the media fast forwards/reverses

2 - Desktop screenreader
- WHEN I use a desktop screenreader (NVDA, JAWS, VoiceOver) AND 
- I use the tab key to move focus to a control
  - I HEAR The media control purpose is clear (play, pause, stop)
  - I HEAR Media controls identify as button, switch, range etc.
  - I HEAR Audio content never autoplays
  - I HEAR It expresses it state if applicable (pressed, expanded, disabled)
- THEN when I use the spacebar and/or enter key to activate the button I HEAR the intended action occurs

- THEN when I use the arrow keys (left/right) I HEAR the media fast forwards/reverses

3 - Mobile screenreader
- WHEN I use a mobile screenreader AND
  - I swipe to move focus to a media control
  - I HEAR The media control purpose is clear (play, pause, stop)
  - I HEAR Media controls identify as button, switch, range etc.
  - I HEAR Audio content never autoplays
  - I HEAR It expresses it state if applicable (pressed, expanded, disabled)
- THEN when I doubletap with the media control in focus I HEAR the intended action occurs

Full information: https://www.atomica11y.com/accessible-web/video-audio/
