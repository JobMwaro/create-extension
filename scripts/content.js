


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
  document.body.appendChild(container);

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

  //#region idle buttons
  // Create a new div element for the action buttons
  var actionDiv = document.createElement('div');
  actionDiv.className = 'action-buttons';
  actionDiv.style.boxShadow = '2px 2px 4px rgba(0, 0, 0, 0.2)';
  actionDiv.style.border = '1px solid #000'; // Border style
  actionDiv.style.background = '#ffff'; // Background color
  actionDiv.style.color = '#0000';
  actionDiv.style.borderRadius = '20px';
  actionDiv.style.width = '40px'; /* Diameter of the circle */
  actionDiv.style.height = '110px';
  actionDiv.style.textAlign = 'center';
  

  // Create three buttons and append them to the action div
  var button1 = document.createElement('button');
  // button1.textContent = '1';
  button1.className = 'inner-button';
  button1.id = 'button1';
  imgURL = chrome.runtime.getURL("icons/stop-button.png");
  var span1 = document.createElement('span');
  span1.innerHTML = "<img src="+imgURL+" alt='stop'>";
  button1.appendChild(span1)
  // button1.innerHTML = "<img src="+imgURL+" alt='stop'>";
  actionDiv.appendChild(button1);

  var verticalView = document.createElement('br');
  actionDiv.appendChild(verticalView);

  var button2 = document.createElement('button');
  // button2.textContent = '2';
  button2.className = 'inner-button';
  imgURL1 = chrome.runtime.getURL("icons/check-mark.png");
  button2.innerHTML = "<img src="+imgURL1+" alt='stop'>";
  actionDiv.appendChild(button2);

  var verticalView = document.createElement('br');
  actionDiv.appendChild(verticalView);

  var button3 = document.createElement('button');
  button3.textContent = '3';
  button3.className = 'inner-button';
  actionDiv.appendChild(button3);

  document.body.appendChild(actionDiv);

  // Hide the action div by default
  actionDiv.style.display = 'none';

  var styleInnerButtons = document.querySelectorAll('.inner-button');
  styleInnerButtons.forEach(function(button) {
    button.style.boxShadow = '2px 2px 4px rgba(0, 0, 0, 0.2)';
    button.style.border = '1px solid #000'; // Border style
    button.style.background = '#fff'; // Background color
    button.style.color = '#000';
    button.style.borderRadius = '50%';
    button.style.width = '30px'; /* Diameter of the circle */
    button.style.height = '30px';
    button.style.bottom = '20px';
    button.style.margin = '2px 0px 0px 0px';
    button.style.transition = "transform 0.2s ease-in-out 0s";
    button.addEventListener('mouseover', function(){
      button.style.transform = 'scale(1.2)';
    })
    button.addEventListener('mouseout', function(){
      button.style.transform = 'scale(1.0)';
    })
  
  });

    
  // Create and append the button to the body of the page
  const button = document.createElement('button');
  button.innerHTML = 'Create';
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.padding = '10px';
  button.style.borderRadius = '10px';
  button.style.boxShadow = '2px 2px 4px rgba(0, 0, 0, 0.2)';
  button.style.border = '1px solid #000'; // Border style
  button.style.background = '#fff'; // Background color
  button.style.color = '#000'; // Text color
  // document.body.appendChild(button);
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
    // if(event.target == container){
    //   var actionButtons = document.querySelector('.action-buttons');
    //   var style = window.getComputedStyle(actionButtons);
    //   if (style.display === 'none') {
    //     // Show the action div when the mouse is over the container
    //     actionDiv.style.display = 'block';
    //     actionDiv.style.position = 'fixed'; // Add this line
    //     actionDiv.style.bottom = '105px'; // Adjust the top distance as needed
    //     actionDiv.style.right = '40px'; // Adjust the right distance as needed
    //   }
    //   else{
    //     actionDiv.style.display = 'none';
    //   }
    // }
    else{
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
            
            console.log(parseInt(separated.elementTypes[6].slice(11))); // Output: ["elementType1", "elementType10", ...]
            // console.log(separated.elementValues); // Output: ["elementValue1", "elementValue10", ...]
            // console.log(separated.steps);          // Output: ["step1", "step2", ...]
        
          });

          const flashDiv = document.createElement('div');
          flashDiv.classList.add('flash');
          flashDiv.id = 'capturedArea';
          flashDiv.style.position = 'fixed';
          flashDiv.style.width = '1920px';
          flashDiv.style.height = '1013px';
          flashDiv.style.backgroundColor = 'white';
          document.body.appendChild(flashDiv);

          const audioElement = document.createElement('audio');
          audioElement.id = 'cameraShutterSound';
          const audioSource = document.createElement('source');
          audioSource.src = chrome.runtime.getURL('assets/shutterSound.mp3'); 
          audioSource.type = 'audio/mpeg';
          audioElement.appendChild(audioSource);
          document.body.appendChild(audioElement);
          audioElement.play();

          setTimeout(() => {
            document.body.removeChild(flashDiv);
          }, 100); 

        });
    }
  }
 
  // Add event listener to detect clicks on the document
  document.addEventListener('click', handleClick);

}







