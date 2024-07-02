


// Check if customRibbon already exists before creating it
if (!document.querySelector('.custom-ribbon')) {
  // Create a div element for the circular ribbon
  const customRibbon = document.createElement('div');
  customRibbon.classList.add('custom-ribbon');

  // Attach the ribbon to the document body
  document.body.appendChild(customRibbon);

  // Function to update ribbon position
  function updateRibbonPosition(event) {
    customRibbon.style.left = event.pageX + 'px';
    customRibbon.style.top = event.pageY + 'px';
  }

  // Add event listener to update ribbon position on mousemove
  document.addEventListener('mousemove', updateRibbonPosition);
  
  //#region idle buttons
  var img = document.createElement("img");
  var label = document.createTextNode("Stop recording");
  var container = document.createElement('div');
  container.className = 'button-container';
  // container.innerText = "Create"
  container.style.top = '600px';
  container.style.right = '40px';
  container.style.position = 'fixed';
  container.style.zIndex = "10000";
  container.style.backgroundImage = 'linear-gradient(#42A1EC, #0070C9)';
  container.style.border = '1px solid #0077CC';
  container.style.borderRadius = '4px';
  container.style.boxSizing = 'border-box';
  container.style.color = '#FFFFFF';
  container.style.cursor = 'pointer';
  container.style.direction = 'ltr';
  container.style.display = 'block';
  container.style.fontFamily = '"SF Pro Text", "SF Pro Icons", "AOS Icons", "Helvetica Neue", Helvetica, Arial, sans-serif';
  container.style.fontSize = '14px';
  container.style.fontWeight = '400';
  container.style.height = '29px';
  container.style.letterSpacing = '-.022em';
  container.style.lineHeight = '1.47059';
  container.style.minWidth = '30px';
  container.style.overflow = 'visible';
  container.style.padding = '4px 15px';
  container.style.textAlign = 'center';
  container.style.userSelect = 'none';
  container.style.webkitUserSelect = 'none';
  container.style.touchAction = 'manipulation';
  container.style.whiteSpace = 'nowrap';

  iconURL = chrome.runtime.getURL("/assets/how-to-logo-icon.png");
  img.src = iconURL;
  img.style.width = "15%";
  img.style.float = "left";
  img.style.paddingRight = "10px";
  img.style.borderRight = "2px solid #0077CC";

  container.appendChild(img);
  container.appendChild(label);
  // document.body.appendChild(container);

  // Hover state
  container.addEventListener('mouseover', () => {
      container.style.backgroundImage = 'linear-gradient(#51A9EE, #147BCD)';
      container.style.borderColor = '#1482D0';
      container.style.textDecoration = 'none';
  });

  // Active state
  container.addEventListener('mousedown', () => {
      container.style.backgroundImage = 'linear-gradient(#3D94D9, #0067B9)';
      container.style.borderColor = '#006DBC';
      container.style.outline = 'none';
  });

  // Focus state
  container.addEventListener('focus', () => {
      container.style.boxShadow = 'rgba(131, 192, 253, 0.5) 0 0 0 3px';
      container.style.outline = 'none';
  });
  //#endregion

  // Create a port and store it in a variable
  function handleClick(event){
    // Get the element that was clicked
    var element = event.target;
    // // Get the element's type and value
    var type = element.tagName;
    var value = element.value || element.textContent;

    var sendElementAndValue = [type, value];
    // // Log the results to the console
    // console.log("The element type is " + type);
    // console.log("The element value is " + value);
    
    
    const button11 = document.querySelector('#button1');
    if(event.target == container){
      console.log("You clicked the create button")
      let port = chrome.runtime.connect({name: "8081"});
      port.postMessage({action: "getActiveTab"});
      // Listen for messages from the port
      port.onMessage.addListener(function(message) {
        // Handle the response here
        console.log("Received response:", message.success);
      });
    }
    else{

      let port1 = chrome.runtime.connect({name: "maximizeWindow"});
      // Send a message through the port
      port1.postMessage({action: "maximize"});
      // Listen for messages from the port
      port1.onMessage.addListener(function(message) {
        // Handle the response here
        if(message.success === true){
          console.log("maximize window")
          const warningMsg = document.createElement('div');
          warningMsg.classList.add('message-box-fail');
          warningMsg.id = 'capturedArea';
          warningMsg.style.flexDirection = 'column';
          warningMsg.style.alignItems = 'center';
          warningMsg.style.justifyContent = 'center';
          warningMsg.style.textAlign = 'center';
          // Create image element
          const warningImg = document.createElement('img');
          var warningImgURL = chrome.runtime.getURL("/assets/icons8-warning-48.png");
          warningImg.src = warningImgURL;
          warningImg.style.width = '20%';
          // Create text node
          const warningText = document.createElement('p');
          warningText.innerText = "Please maximize your browser window to continue!";
          warningText.style.fontSize = '80%';
          warningText.style.marginBottom = '20px';

          // Append text and image to warningMsg
          
          warningMsg.appendChild(warningImg);
          warningMsg.appendChild(warningText);

          document.body.appendChild(warningMsg);

          setTimeout(() => {
            document.body.removeChild(warningMsg);
          }, 3000); 
        }
        else {
          let port = chrome.runtime.connect({name: "8080"});
          // Send a message through the port
          port.postMessage(sendElementAndValue);
          port.postMessage({action: "getActiveTab"});
          console.log("Message sent")
          // Listen for messages from the port
          port.onMessage.addListener(function(message) {
            // Handle the response here
            // console.log("Received response:", message.success);
            chrome.storage.local.get(null, function (result) {
              // Use the result object to access the data
              var allKeys = Object.keys(result);
              // console.log('The keys are ' + allKeys.join(', '));
              // allKeys.sort(function(a, b) {
              //   return parseInt(a.slice(4)) - parseInt(b.slice(4));
              // });
              // console.log('The keys are ' + allKeys.join(', '));
  
              // Loop through the keys and get the values
              for (var key of allKeys) {
                var value = result[key];
                // console.log('The value of ' + key + ' is ' + value);
              }
  
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
              
              // console.log(parseInt(separated.elementTypes[6].slice(11))); // Output: ["elementType1", "elementType10", ...]
              // console.log(separated.elementValues); // Output: ["elementValue1", "elementValue10", ...]
              // console.log(separated.steps);          // Output: ["step1", "step2", ...]
              // console.log(result[separated.elementTypes[9]]);
              // console.log(result[separated.elementValues[9]]);
              // console.log(result[separated.steps[9]]);

              const flashDiv = document.createElement('div');
              flashDiv.classList.add('flash');
              flashDiv.id = 'capturedArea';
              flashDiv.style.position = 'fixed';
              flashDiv.style.top = '0';
              flashDiv.style.left = '0';
              flashDiv.style.width = '100%';
              flashDiv.style.height = '100%';
              flashDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              flashDiv.style.zIndex = '2147483649';
              // flashDiv.style.opacity = '0.1';
              flashDiv.style.border = '3px solid purple';
              // flashDiv.style.borderRight = '3px solid purple';
              document.body.appendChild(flashDiv);
    
              setTimeout(() => {
                document.body.removeChild(flashDiv);
              }, 100); 
              
            });
  
  
            // const audioElement = document.createElement('audio');
            // audioElement.id = 'cameraShutterSound';
            // const audioSource = document.createElement('source');
            // audioSource.src = chrome.runtime.getURL('assets/shutterSound.mp3'); 
            // audioSource.type = 'audio/mpeg';
            // audioElement.appendChild(audioSource);
            // document.body.appendChild(audioElement);
            // audioElement.play();
  
  
          });
        }
      }); 
    }
  }
 
  // Add event listener to detect clicks on the document
  document.addEventListener('click', handleClick);

}







