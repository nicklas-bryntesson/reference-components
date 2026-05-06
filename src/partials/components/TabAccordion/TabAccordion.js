const dropdownComponentNode = document.querySelector(".dropdown-accordion");
const dropdownPanelButtonNodes =
  dropdownComponentNode.querySelectorAll(".panel-toggle");

dropdownPanelButtonNodes.forEach((button) => {
  button.addEventListener("click", (event) => {
    const clickedButton = event.target;

    if (clickedButton.classList.contains("active")) {
      return;
    }

    // close all panels:
    dropdownPanelButtonNodes.forEach((button) => {
      const iconNode = button.querySelector("span");
      const parentNode = button.parentNode;
      const panelNode = parentNode.nextElementSibling;
      panelNode.classList.remove("expanded");
      button.classList.remove("active");
      button.setAttribute("aria-expanded", "false");
      iconNode.textContent = "+";
    });

    // open clicked panel:
    const iconNode = clickedButton.querySelector("span");
    const parentNode = clickedButton.parentNode;
    const panelNode = parentNode.nextElementSibling;
    clickedButton.classList.add("active");
    panelNode.classList.add("expanded");
    clickedButton.setAttribute("aria-expanded", "true");
    iconNode.textContent = "-";
  });
});

const dropdownSubPanelButtonNodes =
  dropdownComponentNode.querySelectorAll(".sub-panel-toggle");

dropdownSubPanelButtonNodes.forEach((button) => {
  button.addEventListener("click", (event) => {
    const buttonNode = event.currentTarget;
    const iconNode = buttonNode.querySelector("span");
    const parentNode = buttonNode.parentNode;
    const panelNode = parentNode.nextElementSibling;
    panelNode.classList.toggle("expanded");
    buttonNode.classList.toggle("active");
    buttonNode.setAttribute(
      "aria-expanded",
      buttonNode.getAttribute("aria-expanded") === "true" ? "false" : "true"
    );
    iconNode.textContent = iconNode.textContent === "+" ? "-" : "+";
  });
});
