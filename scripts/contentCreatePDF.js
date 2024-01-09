


 // Create and append the button to the body of the page
 const button = document.createElement('button');
 button.innerHTML = 'Generate';
 button.style.position = 'fixed';
 button.style.bottom = '75px';
 button.style.right = '40px';
 button.style.padding = '5px';
 button.style.borderRadius = '15px';
 button.style.boxShadow = '2px 2px 4px rgba(0, 0, 0, 0.2)';
 button.style.border = '1px solid #000'; // Border style
 button.style.background = '#fff'; // Background color
 button.style.color = '#000'; // Text color
 button.style.width = '100px';
 button.style.textAlign = 'center';
 document.body.appendChild(button);

 button.addEventListener('click', function(){
  console.log("Button Clicked")
  chrome.storage.local.get(null, function(result) {
    var allKeys = Object.keys(result);

    allKeys.sort(function(a, b) {
      return parseInt(a.slice(4)) - parseInt(b.slice(4));
    });

    var doc = new window.jspdf.jsPDF('p', 'mm', 'a4'); // Access jsPDF from the window object
    var imagesLoaded = 0; // Counter to track loaded images
    var imagesAdded = 0;
    var autoAdjustImg = 0;

    
    // Get page dimensions
    var pageSize = doc.internal.pageSize;
    var pageWidth = pageSize.getWidth();
    let userGuideTitleContentIdGetter = document.getElementById('userGuideTitleContent');
    let userGuideTitleContentValue = userGuideTitleContentIdGetter.innerHTML;
    let headingText = userGuideTitleContentValue;
    var fontSize = 25;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    // Get text width
    var headingTextWidth = doc.getTextDimensions(headingText).w;
    // Calculate center position for horizontal alignment
    var headingTextX = (pageWidth - headingTextWidth) / 2;
    let lineWidth = 40; 
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
        y += 10; 
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
        if(autoAdjustImg === 0){
          doc.addImage(value, 'PNG', imgX, 33 + imagesAdded * 122, imgWidth, imgHeight);
          console.log('Auto adjust Image position1 '+autoAdjustImg)
        }else{
          doc.addImage(value, 'PNG', imgX, autoAdjustImg + 12 + imagesAdded * 122, imgWidth, imgHeight);
          console.log('Auto adjust Image position '+autoAdjustImg)
        }
        
        //Add step
        stepNumberText = 'Step #'+parseInt(key.slice(4));
        // Set font size and type
        var fontSize = 18;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'bold');

        // Get text width
        var textWidth = doc.getTextDimensions(stepNumberText).w;

        // Calculate center position for horizontal alignment
        var textX = (pageWidth - textWidth) / 2;
        doc.setTextColor("#8A2BE2");
        doc.text(stepNumberText,textX, 129 + imagesAdded * 122);

        let stepDescriptionIdSetter = 'stepDescription'+key;
        let stepDescriptionIdGetter = document.getElementById(stepDescriptionIdSetter);
        let stepDescriptionIdValue = stepDescriptionIdGetter.innerHTML;
        let stepDescriptionText = stepDescriptionIdValue;
        // Set font size and type
        var fontSize = 14;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor("#000000");
        const lineWidth = 75; // Adjust as needed
        const lines = stepDescriptionText.split(/\s+/).reduce((lines, word) => {
          if (lines[lines.length - 1].length + word.length > lineWidth) {
              lines.push("");
          }
          lines[lines.length - 1] += word + " ";
          return lines;
        }, [""]);
        let y = 137 + imagesAdded * 122; // Initial y-coordinate
        const pageWidth1 = doc.internal.pageSize.getWidth(); // Get actual page width
        var numberOfLines = 1;
        var textHeight =1;
        lines.forEach(line => {
            const textWidth = doc.getTextDimensions(line).w // Calculate text width
            textHeight = doc.getTextDimensions(line).h;
            const x = (pageWidth1 - textWidth) / 2; // Center horizontally
            doc.text(line, x, y);
            y += 6; 
            numberOfLines += 1;
        });
        autoAdjustImg = numberOfLines * textHeight;
        imagesLoaded++;
        imagesAdded++;
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
  });

 })




