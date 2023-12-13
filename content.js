
// Check if customRibbon already exists before creating it
if (!document.querySelector('.custom-ribbon')) {
  // Create a div element for the circular ribbon
  const customRibbon = document.createElement('div');
  customRibbon.classList.add('custom-ribbon');

  // Attach the ribbon to the document body
  document.body.appendChild(customRibbon);

  // Function to update ribbon position
  function updateRibbonPosition(event) {
    customRibbon.style.left = event.clientX + 'px';
    customRibbon.style.top = event.clientY + 'px';
  }

  // Add event listener to update ribbon position on mousemove
  document.addEventListener('mousemove', updateRibbonPosition);

    
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
  document.body.appendChild(button);

  var srcUrl;
  // Create a port and store it in a variable
  function handleClick(event){
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

  // Add event listener to detect clicks on the document
  document.addEventListener('click', handleClick);  
}







