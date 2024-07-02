
function getSrl(){
    var userGuideTitle = document.createElement('div');
    var userGuideTitleContent = document.createElement('span');
    userGuideTitle.setAttribute('class', 'userGuideTitle');
    userGuideTitleContent.setAttribute('class', 'userGuideTitleContent');
    userGuideTitle.id = 'userGuideTitle';
    userGuideTitleContent.id = 'userGuideTitleContent';
    document.body.appendChild(userGuideTitle);
    userGuideTitleContent.innerHTML = 'New user Step by step guide Title, [double click to edit]';
    var userGuideTitleGetter = document.querySelector('#userGuideTitle');
    userGuideTitleGetter.appendChild(userGuideTitleContent);
    let stepContainerAfter = document.createElement('div');
    stepContainerAfter.setAttribute("class", "stepContainerAfter");
    document.body.appendChild(stepContainerAfter);

    chrome.storage.local.get(null, function(result) {
    var allKeys = Object.keys(result);

    function separateElements(data) {
      const elementTypes = [];
      const elementValues = [];
      const steps = [];
    
      for (const item of data) {
        if (item.startsWith("elementType")) {
          elementTypes.push(item);
        } else if (item.startsWith("elementValue")) {
          elementValues.push(item);
        } else {
          steps.push(item);
        }
      }
    
      return {
        elementTypes,
        elementValues,
        steps,
      };
    }
    
    const separated = separateElements(allKeys);
    console.log(separated.elementTypes); // Output: ["elementType1", "elementType10", ...]
    console.log(separated.elementValues); // Output: ["elementValue1", "elementValue10", ...]
    console.log(separated.steps);          // Output: ["step1", "step2", ...]

    separated.steps.sort(function(a, b) {
      return parseInt(a.slice(4)) - parseInt(b.slice(4));
    });

    // console.log(allKeys);

    for (var key of separated.steps) {
      var value = result[key];
      var stepNo = parseInt(key.slice(4));
      var stepContainer = document.createElement('div');
      var stepContainerAfter = document.createElement('div');
      var stepHeader = document.createElement('div');
      var stepFooter = document.createElement('div');
      var stepActionButtonsContainer = document.createElement('div');
      var stepImg = document.createElement('img');
      var deleteButtonIcon = document.createElement('img');
      var stepTitle = document.createElement("h3");
      var stepDescription = document.createElement("span");
      var stepDeleteButton = document.createElement("button");
      stepContainer.setAttribute("class", "stepContainer");
      stepContainerAfter.setAttribute("class", "stepContainerAfter");
      stepHeader.setAttribute("class", "stepHeader");
      stepFooter.setAttribute("class", "stepFooter");
      stepDescription.setAttribute("class", "stepDescription");
      stepDeleteButton.setAttribute("class", "stepDeleteButton");
      stepActionButtonsContainer.setAttribute("class", "stepActionButtonsContainer");
      var stepContainerIdSetter = 'stepContainer'+key;
      var stepHeaderIdSetter = 'stepHeader'+key;
      var stepFooterIdSetter = 'stepFooter'+key;
      var stepDescriptionIdSetter = 'stepDescription'+key;
      var stepDeleteButtonIdSetter = 'stepDeleteButton'+key;
      var stepActionButtonsContainerSetter = 'stepActionButtonsContainer'+key;
      stepContainer.id = stepContainerIdSetter;
      stepHeader.id = stepHeaderIdSetter;
      stepFooter.id = stepFooterIdSetter;
      stepDescription.id = stepDescriptionIdSetter;
      stepDeleteButton.id = stepDeleteButtonIdSetter;
      stepActionButtonsContainer.id = stepActionButtonsContainerSetter;
      document.body.appendChild(stepContainer);
      document.body.appendChild(stepContainerAfter);
      var stepContainerIdGetter = document.querySelector('#'+stepContainerIdSetter);
      stepContainerIdGetter.appendChild(stepHeader);
      stepContainerIdGetter.appendChild(stepFooter);
      stepContainerIdGetter.appendChild(stepActionButtonsContainer)
      var stepHeaderIdGetter = document.querySelector('#'+stepHeaderIdSetter);
      var stepFooterIdGetter = document.querySelector('#'+stepFooterIdSetter);
      var stepActionButtonsContainerIdGetter = document.querySelector('#'+stepActionButtonsContainerSetter);
      stepImg.id = key;
      stepImg.src = value;
      stepImg.style.width = '120%';
      deleteButtonIcon.src = '/assets/icons8-delete-96-black.png';
      deleteButtonIcon.style.width = '140%';  
      stepDeleteButton.insertBefore(deleteButtonIcon, stepDeleteButton.firstChild);
      stepHeaderIdGetter.appendChild(stepImg);
      stepFooterIdGetter.appendChild(stepTitle);
      stepFooterIdGetter.appendChild(stepDescription);
      stepFooterIdGetter.appendChild(stepDescription);
      stepActionButtonsContainerIdGetter.appendChild(stepDeleteButton);
      stepTitle.innerHTML = 'Step #'+stepNo;
      
      // stepDescription.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris tempor id turpis in porttitor. Vivamus ex felis, efficitur in sodales sit amet, dapibus efficitur ante. Aliquam eu pretium nibh.";
      
      for (var key1 of separated.elementTypes) {
        var elementTypeNo = parseInt(key1.slice(11));
        if (elementTypeNo===stepNo){
          var elementType = result[key1];
          for (var key2 of separated.elementValues) {
            var elementValueNo = parseInt(key2.slice(12));
            // stepDescription.innerHTML = elementValueNo+". "+elementType;
           
            if (elementValueNo===stepNo){
              var elementValue = result[key2];
              stepDescription.innerHTML = elementValueNo+". "+elementType+" "+elementValue;
              if(elementType === "DIV"){
                let trimstepDescription = "Click the \"" + elementValue.trim() + "\" option to access " + elementValue.toLowerCase().trim() + ".";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "SPAN"){
                let trimstepDescription = "Click the \"" + elementValue.trim() + "\" option to " + elementValue.toLowerCase().trim() + ".";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "INPUT"){
                let trimstepDescription = "Click the input field to enter the required data.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "TEXTAREA"){
                let trimstepDescription = "Click the textarea to enter the required data.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "BUTTON"){
                let trimstepDescription = "Click the \"" + elementValue.trim() + "\" button to " + elementValue.toLowerCase().trim() + ".";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "SELECT"){
                let trimstepDescription = "Click the dropdown menu, from the dropdown list, select the desired option.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "A"){
                let trimstepDescription = "Click the \"" + elementValue.trim() + "\" option to access " + elementValue.toLowerCase().trim() + ".";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "H1"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "H2"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "H3"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "H4"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "H5"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "H6"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "P"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "TR"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }
              else if(elementType === "TD"){
                let trimstepDescription = "Click \"" + elementValue.trim() + "\" as shown.";
                if (trimstepDescription.length > 215) {
                  trimstepDescription = trimstepDescription.slice(0, 215);
                  stepDescription.innerHTML = trimstepDescription;
                }
                stepDescription.innerHTML = trimstepDescription;
              }

            }
            
          }
        }
        
      }

      
    
    }

    let parent = document.body;
    parent.addEventListener("dblclick", function(event) {
      let target = event.target;
      if (target.classList.contains("stepDescription")) {
        let input = document.createElement("textarea");
        input.value = target.textContent;
        input.id = target.id;
        input.className = "stepDescriptionEdit";
        target.replaceWith(input);
        input.focus();
        input.cols = 30; // Number of columns
        input.rows = 5;  // Number of rows
        input.addEventListener('input', function() {
          const maxLength =215;
          if (input.value.length > maxLength) {
            input.value = input.value.slice(0, maxLength);
          }
        });
        parent.addEventListener("click", function(event) {
          if (event.target == input) {
            input.focus();
          }
          else {
            let value = input.value;
            let newText = document.createElement("span");
            newText.textContent = value;
            newText.id = input.id;
            newText.className = "stepDescription";
            input.replaceWith(newText);
          }
        });
      }
      else if (target.className.includes("userGuideTitleContent")) {
        let input = document.createElement("textarea");
        input.value = target.textContent;
        input.id = target.id;
        input.className = "stepDescriptionEdit";
        target.replaceWith(input);
        input.focus();
        input.cols = 30; // Number of columns
        input.rows = 5;  // Number of rows
        input.addEventListener('input', function() {
          const maxLength = 65;
          if (input.value.length > maxLength) {
            input.value = input.value.slice(0, maxLength);
          }
        });
        parent.addEventListener("click", function(event) {
          if (event.target == input) {
            input.focus();
          }
          else {
            let value = input.value;
            let newText = document.createElement("span");
            newText.textContent = value;
            newText.id = input.id;
            newText.className = "userGuideTitleContent";
            input.replaceWith(newText);
          }
        });
      }
    });

    parent.addEventListener("click", function(event) {
      let target = event.target;
      if (target.classList.contains("stepDescription")) {
        let input = document.createElement("textarea");
        input.value = target.textContent;
        input.id = target.id;
        input.className = "stepDescriptionEdit";
        target.replaceWith(input);
        input.focus();
        input.cols = 30; // Number of columns
        input.rows = 5;  // Number of rows
        input.addEventListener('input', function() {
          const maxLength =215;
          if (input.value.length > maxLength) {
            input.value = input.value.slice(0, maxLength);
          }
        });
        parent.addEventListener("click", function(event) {
          if (event.target == input) {
            input.focus();
          }
          else {
            let value = input.value;
            let newText = document.createElement("span");
            newText.textContent = value;
            newText.id = input.id;
            newText.className = "stepDescription";
            input.replaceWith(newText);
          }
        });
      }
    });
    
    const stepDeleteButtons = document.querySelectorAll(".stepDeleteButton");
    stepDeleteButtons.forEach((button, index) => {
      button.addEventListener("click", function() {
        
        console.log(this.id);
      });
    });
  });
}

getSrl();