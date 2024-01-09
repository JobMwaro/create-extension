
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

    allKeys.sort(function(a, b) {
      return parseInt(a.slice(4)) - parseInt(b.slice(4));
    });

    for (var key of allKeys) {
      var value = result[key];
      var stepNo = parseInt(key.slice(4));
      var stepContainer = document.createElement('div');
      var stepContainerAfter = document.createElement('div');
      var stepHeader = document.createElement('div');
      var stepFooter = document.createElement('div');
      var stepImg = document.createElement('img');
      var stepTitle = document.createElement("h3");
      var stepDescription = document.createElement("span");
      stepContainer.setAttribute("class", "stepContainer");
      stepContainerAfter.setAttribute("class", "stepContainerAfter");
      stepHeader.setAttribute("class", "stepHeader");
      stepFooter.setAttribute("class", "stepFooter");
      stepDescription.setAttribute("class", "stepDescription");
      var stepContainerIdSetter = 'stepContainer'+key;
      var stepHeaderIdSetter = 'stepHeader'+key;
      var stepFooterIdSetter = 'stepFooter'+key;
      var stepDescriptionIdSetter = 'stepDescription'+key;
      stepContainer.id = stepContainerIdSetter;
      stepHeader.id = stepHeaderIdSetter;
      stepFooter.id = stepFooterIdSetter;
      stepDescription.id = stepDescriptionIdSetter;
      document.body.appendChild(stepContainer);
      document.body.appendChild(stepContainerAfter);
      var stepContainerIdGetter = document.querySelector('#'+stepContainerIdSetter);
      stepContainerIdGetter.appendChild(stepHeader);
      stepContainerIdGetter.appendChild(stepFooter);
      var stepHeaderIdGetter = document.querySelector('#'+stepHeaderIdSetter);
      var stepFooterIdGetter = document.querySelector('#'+stepFooterIdSetter);
      stepImg.id = key;
      stepImg.src = value;
      stepImg.style.width = '120%';
      stepHeaderIdGetter.appendChild(stepImg);
      stepFooterIdGetter.appendChild(stepTitle);
      stepFooterIdGetter.appendChild(stepDescription);
      stepTitle.innerHTML = 'Step #'+stepNo;
      stepDescription.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris tempor id turpis in porttitor. Vivamus ex felis, efficitur in sodales sit amet, dapibus efficitur ante. Aliquam eu pretium nibh.";
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
    
  });
}

getSrl();