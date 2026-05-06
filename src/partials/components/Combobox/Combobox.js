import generateRandomString from "../utility/generateRandomString.js";
import debounce from "../utility/debounce.js";
import { interactionTypeService } from "../utility/interactionTypeTracker.js";

export default function searchDropdown() {
  const searchDropdownsComponent = document.querySelectorAll(
    ".searchDropdownComponent"
  );

  if (searchDropdownsComponent.length === 0) {
    return;
  }

  searchDropdownsComponent.forEach(
    (searchDropdownComponent, componentIndex) => {
      const dataSource = "/data/cities.json";
      const componentID = `searchDropdownComponent-${componentIndex}`;
      const label = searchDropdownComponent.querySelector(".searchLabel");
      const labelText = "Search for your favorite American city";
      const searchDropdown =
        searchDropdownComponent.querySelector(".searchDropdown");

      // Get all inner elements:
      const searchInput = searchDropdown.querySelector('input[type="search"]');
      const fieldset = searchDropdown.querySelector("fieldset");
      const legend = searchDropdown.querySelector("legend");
      const confirmContainer =
        searchDropdown.querySelector(".confirmContainer");

      // Setup our legend text messages
      const noSelectedOptionText = "Choose your favourite American city";
      const selectedOptionText = "Your selected option:";

      // Connect component level aria attributes:
      label.innerHTML = labelText;
      label.setAttribute("for", `searchInput-${componentIndex}`);
      searchInput.id = `searchInput-${componentIndex}`;

      const fieldsetId = `searchDropdownFieldset-${componentIndex}`;
      fieldset.id = fieldsetId;
      searchInput.setAttribute("aria-controls", fieldsetId);

      // Initiate the legend text:
      legend.textContent = noSelectedOptionText;

      // Set up a validation slot and three validation messages:
      const validationSlot = searchDropdown.querySelector(".validationSlot");

      const insufficientCharactersErrorMessage =
        "Please enter at least 3 characters";
      const noMatchingItemsFoundErrorMessage = "No matching items found.";
      const networkErrorMessage = "Network error";

      function displayError(errorMessage) {
        validationSlot.innerHTML = `<p>${errorMessage}</p>`;
        validationSlot.setAttribute("data-visible", "true");
        validationSlot.focus();
        searchDropdown.setAttribute("data-searching", "false");
      }

      function clearError() {
        validationSlot.innerHTML = "";
        validationSlot.setAttribute("data-visible", "false");
      }

      // Start tracking interactiontype when componentis in use: ie, when the search gets focus.
      searchInput.addEventListener("focus", () => {
        interactionTypeService.startTracking();
        console.log("Tracking started");
      });

      // This will ensure that if the user starts scrolling inside the fieldset, the focus will be set to it
      fieldset.addEventListener(
        "scroll",
        debounce(() => {
          // Check if the fieldset is already the active element or not
          if (document.activeElement !== fieldset) {
            // If not, focus the fieldset
            fieldset.focus({ preventScroll: true });
            console.log("Fieldset focused");
          }
        }, 200)
      ); // 200 ms debounce time

      fieldset.addEventListener("touchmove", () => {
        // User is actively touching and moving within the fieldset
        if (document.activeElement !== fieldset) {
          fieldset.focus();
        }
      });

      // Get the data from the source:
      let data = [];

      async function fetchData() {
        try {
          const response = await fetch(dataSource);
          if (!response.ok) {
            throw new Error(
              `${networkErrorMessage} - ${response.status} ${response.statusText}`
            );
          }
          data = await response.json();
        } catch (error) {
          displayError(error.message);
        }
      }

      // Populate the template if we have data:
      const responseSlot = searchDropdown.querySelector(".responseSlot");
      const responseTemplate =
        searchDropdown.querySelector(".responseTemplate");

      function populateItems(response, itemIndex) {
        const clone = responseTemplate.content.cloneNode(true);

        const radio = clone.querySelector('input[type="radio"]');
        const label = clone.querySelector("label");
        const labelHeading = clone.querySelector(".labelHeading");
        const labelSubheading = clone.querySelector(".labelSubheading");
        const discardButton = clone.querySelector(".discardButton");

        radio.id = `radioId-${componentIndex}-${itemIndex}`;
        radio.value = response.title;
        radio.name = `radioName-${componentIndex}`;
        labelHeading.id = `labelHeadingId-${componentIndex}-${itemIndex}`;
        labelHeading.textContent = response.title;
        labelSubheading.id = `labelSubHeadingId-${componentIndex}-${itemIndex}`;
        labelSubheading.textContent = response.subTitle;
        label.setAttribute("for", `radioId-${componentIndex}-${itemIndex}`);
        radio.setAttribute(
          "aria-labelledby",
          `labelHeadingId-${componentIndex}-${itemIndex}`
        );
        radio.setAttribute(
          "aria-describedby",
          `labelSubHeadingId-${componentIndex}-${itemIndex}`
        );
        discardButton.setAttribute("data-visible", "false");

        discardButton.addEventListener("click", handleDeselection);

        // This is the most important part of this component.
        // We must distinguish between keyboard and mouse/touch selection so we can enable a confirm selection path for keyboard users.
        // The change event for radio buttons will always be interpred as a mouse/touch selection by default.
        radio.addEventListener("change", (event) => {
          // Use the getLastInteractionType to determine the source of the "change" event.
          const interactionType =
            interactionTypeService.getLastInteractionType();

          // Call the appropriate handler based on the interaction type.
          if (interactionType === "keyboard") {
            handleKeyboardSelection(event);
          } else if (
            interactionType === "mouse" ||
            interactionType === "touch"
          ) {
            handleMouseOrTouchSelection(event);
          }
        });

        responseSlot.appendChild(clone);
      }

      function resetComponent() {
        searchDropdownComponent.setAttribute("data-searching", "false");
        searchDropdownComponent.setAttribute("data-have-selection", "false");
        confirmContainer.setAttribute("data-visible", "false");
        searchInput.value = "";
        searchInput.setAttribute("data-visible", "true");
        searchInput.focus();
        fieldset.setAttribute("data-visible", "false");
        responseSlot.innerHTML = "";
        clearError();
        legend.textContent = noSelectedOptionText;
        data = [];
      }

      function handleMouseOrTouchSelection(event) {
        console.log("Mouse or touch selection");

        event.target
          .closest(".searchResponseItem")
          .setAttribute("data-selected", "true");

        event.target.checked = true;

        Array.from(
          responseSlot.querySelectorAll('input[type="radio"]')
        ).forEach((radio) => {
          if (radio !== event.target) {
            radio.closest(".searchResponseItem").remove(); // Assuming each radio is wrapped in a div with class 'response'
          }
        });

        // 3. Hide the search input.
        searchInput.setAttribute("data-visible", "false");
        searchDropdownComponent.setAttribute("data-have-selection", "true");

        // 4. Set the legend text.
        const selectedItemTitle = event.target
          .closest(".searchResponseItem")
          .querySelector(".labelHeading").textContent;
        legend.textContent = `${selectedOptionText} ${selectedItemTitle}`;

        // 5. Set the discardBtn attribute visible to true.
        event.target
          .closest(".searchResponseItem")
          .querySelector(".discardButton")
          .setAttribute("data-visible", "true");

        // Stop tracking interaction type when component is not in use: ie after selction is made.
        interactionTypeService.stopTracking();
        console.log("Tracking stopped");
      }

      function handleKeyboardSelection(event) {
        console.log("Keyboard selection");
        confirmContainer.setAttribute("data-visible", "true");
        const confirmationMessage = confirmContainer.querySelector("p");
        const confirmButton = confirmContainer.querySelector("button");

        // Reference to the selected radio input to use in the closure below
        const selectedRadio = event.target;

        confirmationMessage.innerHTML = `Confirm ${
          selectedRadio
            .closest(".searchResponseItem")
            .querySelector(".labelHeading").textContent
        }?`;

        // Remove previous click listeners to prevent duplicates
        const existingConfirmButtonOnclick = confirmButton.onclick;
        if (existingConfirmButtonOnclick) {
          confirmButton.removeEventListener(
            "click",
            existingConfirmButtonOnclick
          );
        }

        // Event listener for the confirmation button click
        confirmButton.onclick = function () {
          selectedRadio
            .closest(".searchResponseItem")
            .setAttribute("data-selected", "true");
          selectedRadio.checked = true;

          // Clear all inputs that are not selected.
          Array.from(
            responseSlot.querySelectorAll('input[type="radio"]')
          ).forEach((radio) => {
            if (radio !== selectedRadio) {
              // Now correctly references the selected radio input
              radio.closest(".searchResponseItem").remove();
            }
          });

          // Hide the search input and show the discard button for the selected item
          searchDropdownComponent.setAttribute("data-have-selection", "true");
          searchInput.setAttribute("data-visible", "false");
          legend.textContent = `${selectedOptionText} ${
            selectedRadio
              .closest(".searchResponseItem")
              .querySelector(".labelHeading").textContent
          }`;
          selectedRadio
            .closest(".searchResponseItem")
            .querySelector(".discardButton")
            .setAttribute("data-visible", "true");

          // Hide the confirmation container again
          confirmContainer.setAttribute("data-visible", "false");
          selectedRadio.focus();
          // Stop tracking interaction type
          interactionTypeService.stopTracking();
          console.log("Tracking stopped (keyboard)");
        };
        console.log("Keyboard selection end");
      }

      function handleDeselection() {
        resetComponent();
      }

      function handleSearch() {
        let searchTimer;

        async function filterAndDisplayData() {
          clearError();

          try {
            if (data.length === 0) {
              await fetchData();
            }

            responseSlot.innerHTML = "";

            const filteredData = data.filter((item) =>
              item.title.toLowerCase().includes(searchInput.value.toLowerCase())
            );

            if (filteredData.length > 0) {
              filteredData.forEach((item, index) => populateItems(item, index));
              fieldset.setAttribute("data-visible", "true");
            } else {
              displayError(noMatchingItemsFoundErrorMessage);
            }
          } catch (error) {
            displayError(error.message);
          }
        }

        return function handleSearchEvent() {
          const searchValueLength = searchInput.value.length;

          clearTimeout(searchTimer); // Clear the timer on new input

          // Reset component if no characters are in the search input
          if (searchValueLength === 0) {
            searchDropdownComponent.setAttribute("data-searching", "false");
            resetComponent();
            return;
          }

          if (searchValueLength >= 1 && searchValueLength <= 2) {
            searchDropdownComponent.setAttribute("data-searching", "true");
          }

          if (searchValueLength < 3) {
            searchTimer = setTimeout(() => {
              if (searchValueLength > 0 && searchValueLength < 3) {
                searchDropdownComponent.setAttribute("data-searching", "false");
                displayError(insufficientCharactersErrorMessage);
              }
            }, 3000);
          } else {
            filterAndDisplayData()
              .then(() => {
                searchDropdownComponent.setAttribute("data-searching", "false");
              })
              .catch(() => {
                searchDropdownComponent.setAttribute("data-searching", "false");
              });
          }
        };
      }
      searchInput.addEventListener("input", handleSearch());
    }
  );
}
