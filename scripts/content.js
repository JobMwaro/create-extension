


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

  // Get the button-container element
  var container = document.createElement('div');
  container.className = 'button-container';
  container.style.position = 'fixed';
  container.innerText = "Create"
  container.style.bottom = '65px';
  container.style.right = '40px';
  container.style.padding = '5px';
  container.style.boxShadow = '2px 2px 4px rgba(0, 0, 0, 0.2)';
  container.style.border = '1px solid #000'; // Border style
  container.style.background = '#fff'; // Background color
  container.style.color = '#000';
  container.style.borderRadius = '20px';
  container.style.width = '100px';
  container.style.textAlign = 'center';
  document.body.appendChild(container);

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

  // Create a port and store it in a variable
  function handleClick(event){
    // Get the element that was clicked
    // var element = event.target;
    // // Get the element's type and value
    // var type = element.tagName;
    // var value = element.value || element.textContent;
    // // Log the results to the console
    // console.log("The element type is " + type);
    // console.log("The element value is " + value);
    const button11 = document.querySelector('#button1');
    if(event.target == container){
      console.log("You clicked the create button")
      let port = chrome.runtime.connect({name: "8081"});
      // Send a message through the port
      port.postMessage({action: "getActiveTab"});
      // Listen for messages from the port
      port.onMessage.addListener(function(message) {
        // Handle the response here
        console.log("Received response:", message.success);
      });
    }
    if(event.target == container){
      var actionButtons = document.querySelector('.action-buttons');
      var style = window.getComputedStyle(actionButtons);
      if (style.display === 'none') {
        // Show the action div when the mouse is over the container
        actionDiv.style.display = 'block';
        actionDiv.style.position = 'fixed'; // Add this line
        actionDiv.style.bottom = '105px'; // Adjust the top distance as needed
        actionDiv.style.right = '40px'; // Adjust the right distance as needed
      }
      else{
        actionDiv.style.display = 'none';
      }
    }
    else{
      let port = chrome.runtime.connect({name: "8080"});
      // Send a message through the port
      port.postMessage({action: "getActiveTab"});
      console.log("Message sent")
      // Listen for messages from the port
      port.onMessage.addListener(function(message) {
        // Handle the response here
        console.log("Received response:", message.success);

        chrome.storage.local.get(null, function (result) {
          // Use the result object to access the data
          var allKeys = Object.keys(result);
          console.log('The keys are ' + allKeys.join(', '));

          // Loop through the keys and get the values
          for (var key of allKeys) {
            var value = result[key];
            console.log('The value of ' + key + ' is ' + value);
          }
        });

      });
    }
  }


 
  // Add event listener to detect clicks on the document
  document.addEventListener('click', handleClick);


}







