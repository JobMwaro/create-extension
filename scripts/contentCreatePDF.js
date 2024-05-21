


 // Create and append the button to the body of the page
 const button = document.createElement('button');
 button.innerHTML = 'Generate';
 button.style.position = 'fixed';
 button.style.bottom = '75px';
 button.style.right = '40px';
//  button.style.padding = '5px';
//  button.style.borderRadius = '15px';
//  button.style.boxShadow = '2px 2px 4px rgba(0, 0, 0, 0.2)';
//  button.style.border = '1px solid #000'; // Border style
//  button.style.background = '#fff'; // Background color
//  button.style.color = '#000'; // Text color
 button.style.width = '100px';
//  button.style.textAlign = 'center';
//  document.body.appendChild(button);

 button.style.backgroundImage = 'linear-gradient(#42A1EC, #0070C9)';
  button.style.border = '1px solid #0077CC';
  button.style.borderRadius = '4px';
  button.style.boxSizing = 'border-box';
  button.style.color = '#FFFFFF';
  button.style.cursor = 'pointer';
  button.style.direction = 'ltr';
  button.style.display = 'block';
  button.style.fontFamily = '"SF Pro Text", "SF Pro Icons", "AOS Icons", "Helvetica Neue", Helvetica, Arial, sans-serif';
  button.style.fontSize = '14px';
  button.style.fontWeight = '400';
  button.style.height = '29px';
  button.style.letterSpacing = '-.022em';
  button.style.lineHeight = '1.47059';
  button.style.minWidth = '30px';
  button.style.overflow = 'visible';
  button.style.padding = '4px 15px';
  button.style.textAlign = 'center';
  button.style.userSelect = 'none';
  button.style.webkitUserSelect = 'none';
  button.style.touchAction = 'manipulation';
  button.style.whiteSpace = 'nowrap';
  document.body.appendChild(button);

  // Hover state
  button.addEventListener('mouseover', () => {
      button.style.backgroundImage = 'linear-gradient(#51A9EE, #147BCD)';
      button.style.borderColor = '#1482D0';
      button.style.textDecoration = 'none';
  });

  // Active state
  button.addEventListener('mousedown', () => {
      button.style.backgroundImage = 'linear-gradient(#3D94D9, #0067B9)';
      button.style.borderColor = '#006DBC';
      button.style.outline = 'none';
  });

  // Focus state
  button.addEventListener('focus', () => {
      button.style.boxShadow = 'rgba(131, 192, 253, 0.5) 0 0 0 3px';
      button.style.outline = 'none';
  });

  // Blur state
  button.addEventListener('blur', () => {
      button.style.boxShadow = '';
  });

 button.addEventListener('click', function(){
  console.log("Button Clicked")
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
    // console.log(separated.elementTypes); // Output: ["elementType1", "elementType10", ...]
    // console.log(separated.elementValues); // Output: ["elementValue1", "elementValue10", ...]
    // console.log(separated.steps);          // Output: ["step1", "step2", ...]

    separated.steps.sort(function(a, b) {
      return parseInt(a.slice(4)) - parseInt(b.slice(4));
    });

    // allKeys.sort(function(a, b) {
    //   return parseInt(a.slice(4)) - parseInt(b.slice(4));
    // });

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
        }
        else if(autoAdjustImg !== 0 && imagesAdded === 0){
          doc.addImage(value, 'PNG', imgX, 33 + imagesAdded * 122, imgWidth, imgHeight);
          console.log('Auto adjust Image position1 '+autoAdjustImg)
        }
        else{
          doc.addImage(value, 'PNG', imgX, autoAdjustImg + 11 + imagesAdded * 122, imgWidth, imgHeight);
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

        if(autoAdjustImg === 0){
          doc.text(stepNumberText,textX, 129 + imagesAdded * 122);
          console.log('First step text');
        }
        else if(autoAdjustImg !== 0 && imagesAdded === 0){
          doc.text(stepNumberText,textX, 129 + imagesAdded * 122);
        }
        else{
          doc.text(stepNumberText,textX, autoAdjustImg + 109 + imagesAdded * 122);
        }
        

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
        let y = 0;
        if(autoAdjustImg === 0){
          y = 137 + imagesAdded * 122;
        }
        else if(autoAdjustImg !== 0 && imagesAdded === 0){
          y = 137 + imagesAdded * 122;
        }
        else{
          y = autoAdjustImg + 117 + imagesAdded * 122;
          autoAdjustImg = 0;
        }

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
        if(imagesLoaded === separated.steps.length){
          // Save the PDF
          doc.save('create_user_guide.pdf');
        }
      };
      img.src = value; // Set the source of the image object
    }

    for (var key of separated.steps) {
      var value = result[key];
      console.log('The value is ' + value);
      addImageToPDF(value, key);
    }
  });

 })




