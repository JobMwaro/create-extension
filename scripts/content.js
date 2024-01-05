


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

      var jsPDFPath = chrome.runtime.getURL('./jspdf');

      // Create a script element and add jsPDF to the page
      var scriptElement = document.createElement('script');
      scriptElement.src = jsPDFPath;

      // Append the script element to the document's head
      (document.head || document.documentElement).appendChild(scriptElement);
      console.log("script element appended")
        console.log("script loaded")
        //get images from storage
        chrome.storage.local.get(null, function (result) {
          // Use the result object to access the data
          var allKeys = Object.keys(result);
          console.log('The keys are ' + allKeys.join(', '));

          allKeys.sort(function(a, b) {
            return parseInt(a.slice(4)) - parseInt(b.slice(4));
          });
          
          var doc = new window.jspdf.jsPDF('p', 'mm', 'a4'); // Access jsPDF from the window object
          var imagesLoaded = 0; // Counter to track loaded images
          var imagesAdded = 0;

          
          // Get page dimensions
          var pageSize = doc.internal.pageSize;
          var pageWidth = pageSize.getWidth();
          var headingText = 'New company registration - Step by step guide. Wrap this text';
          var fontSize = 25;
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', 'normal');
          // Get text width
          var headingTextWidth = doc.getTextDimensions(headingText).w;
          // Calculate center position for horizontal alignment
          var headingTextX = (pageWidth - headingTextWidth) / 2;
          let lineWidth = 45; // Adjust as needed
          let lines = headingText.split(/\s+/).reduce((lines, word) => {
            if (lines[lines.length - 1].length + word.length > lineWidth) {
                lines.push("");
            }
            lines[lines.length - 1] += word + " ";
            return lines;
          }, [""]);
          let y = 20;
          lines.forEach(line => {
              let textWidth = doc.getTextDimensions(line).w // Calculate text width
              let x = (pageWidth - textWidth) / 2; // Center horizontally
              doc.text(line, x, y);
              y += 10; // Adjust spacing as needed
          });

          function addImageToPDF(value, key){
            // Create an Image object to get the actual image dimensions
            var img = new Image();
            img.onload = function () {
              var imgWidth = 170; // Width of the image in the PDF
              var imgHeight = (img.height * imgWidth) / img.width; // Maintain aspect ratio

              var availableSpace = doc.internal.pageSize.height - (30 + imagesAdded * 122 + imgHeight); // Calculate available space

              if (availableSpace < 0 && imagesAdded > 0) {
                doc.addPage(); // Move to a new page
                imagesAdded = 0; // Reset image counter for new page
              }

              // Add the image to the PDF
              var imgX = (pageWidth - imgWidth) / 2;
              doc.addImage(value, 'PNG', imgX, 32 + imagesAdded * 122, imgWidth, imgHeight);
              //Add step
              stepNumberText = 'Step #'+parseInt(key.slice(4));
              // Set font size and type
              var fontSize = 16;
              doc.setFontSize(fontSize);
              doc.setFont('helvetica', 'normal');

              // Get text width
              var textWidth = doc.getTextDimensions(stepNumberText).w;

              // Calculate center position for horizontal alignment
              var textX = (pageWidth - textWidth) / 2;
              doc.setTextColor("#8A2BE2");
              doc.text(stepNumberText,textX, 128 + imagesAdded * 122);

              var stepDescriptionText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris tempor id turpis in porttitor. Vivamus ex felis, efficitur in sodales sit amet, dapibus efficitur ante. Aliquam eu pretium nibh, ut elementum purus. Sed dignissim dui a varius pretium. In sit amet eleifend dui, non consequat ante.";
              // Set font size and type
              var fontSize = 12;
              doc.setFontSize(fontSize);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor("#000000");
              const lineWidth = 90; // Adjust as needed
              const lines = stepDescriptionText.split(/\s+/).reduce((lines, word) => {
                if (lines[lines.length - 1].length + word.length > lineWidth) {
                    lines.push("");
                }
                lines[lines.length - 1] += word + " ";
                return lines;
              }, [""]);
              let y = 134 + imagesAdded * 122; // Initial y-coordinate
              const pageWidth1 = doc.internal.pageSize.getWidth(); // Get actual page width
              lines.forEach(line => {
                  const textWidth = doc.getTextDimensions(line).w // Calculate text width
                  const x = (pageWidth1 - textWidth) / 2; // Center horizontally
                  doc.text(line, x, y);
                  y += 5; // Adjust spacing as needed
              });



              imagesLoaded++;
              imagesAdded++;
              console.log(imagesLoaded);
              console.log(allKeys.length);
              console.log(key+' '+value);


              // Check if all images are loaded and then save the PDF
              if(imagesLoaded === allKeys.length){
                // Save the PDF
                doc.save('create_user_guide.pdf');
              }
            };
            img.src = value; // Set the source of the image object
          }

          for (var key of allKeys) {
            var value = result[key];
            console.log('The value is ' + value);
            addImageToPDF(value, key);
          }
          // Loop through the keys and get the values
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







