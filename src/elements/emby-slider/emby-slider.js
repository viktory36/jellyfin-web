define(['browser', 'dom', 'layoutManager', 'keyboardnavigation', 'css!./emby-slider', 'registerElement', 'emby-input'], function (browser, dom, layoutManager, keyboardnavigation) {
    'use strict';

    var EmbySliderPrototype = Object.create(HTMLInputElement.prototype);

    var supportsNativeProgressStyle = false;
    var supportsValueSetOverride = false;

    var enableWidthWithTransform;

    if (Object.getOwnPropertyDescriptor && Object.defineProperty) {

        var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        // descriptor returning null in webos
        if (descriptor && descriptor.configurable) {
            supportsValueSetOverride = true;
        }
    }

    function updateValues() {

        // Do not update values when dragging with keyboard to keep current progress for reference
        if (!!this.keyboardDragging) {
            return;
        }

        var range = this;
        var value = range.value;

        // put this on a callback. Doing it within the event sometimes causes the slider to get hung up and not respond
        requestAnimationFrame(function () {

            var backgroundLower = range.backgroundLower;

            if (backgroundLower) {
                var fraction = (value - range.min) / (range.max - range.min);

                if (enableWidthWithTransform) {
                    backgroundLower.style.transform = 'scaleX(' + (fraction) + ')';
                } else {
                    fraction *= 100;
                    backgroundLower.style.width = fraction + '%';
                }
            }
        });
    }

    function updateBubble(range, value, bubble, bubbleText) {

        requestAnimationFrame(function () {
            var bubbleTrackRect = range.sliderBubbleTrack.getBoundingClientRect();
            var bubbleRect = bubble.getBoundingClientRect();

            var bubblePos = bubbleTrackRect.width * value / 100;
            bubblePos = Math.min(Math.max(bubblePos, bubbleRect.width / 2), bubbleTrackRect.width - bubbleRect.width / 2);

            bubble.style.left = bubblePos + 'px';

            if (range.getBubbleHtml) {
                value = range.getBubbleHtml(value);
            } else {
                if (range.getBubbleText) {
                    value = range.getBubbleText(value);
                } else {
                    value = Math.round(value);
                }
                value = '<h1 class="sliderBubbleText">' + value + '</h1>';
            }

            bubble.innerHTML = value;
        });
    }

    EmbySliderPrototype.attachedCallback = function () {

        if (this.getAttribute('data-embyslider') === 'true') {
            return;
        }

        if (enableWidthWithTransform == null) {
            //enableWidthWithTransform = browser.supportsCssAnimation();
        }

        this.setAttribute('data-embyslider', 'true');

        this.classList.add('mdl-slider');
        this.classList.add('mdl-js-slider');

        if (browser.noFlex) {
            this.classList.add('slider-no-webkit-thumb');
        }
        if (browser.edge || browser.msie) {
            this.classList.add('slider-browser-edge');
        }
        if (!layoutManager.mobile) {
            this.classList.add('mdl-slider-hoverthumb');
        }
        if (layoutManager.tv) {
            this.classList.add('show-focus');
        }

        var containerElement = this.parentNode;
        containerElement.classList.add('mdl-slider-container');

        var htmlToInsert = '';

        if (!supportsNativeProgressStyle) {
            htmlToInsert += '<div class="mdl-slider-background-flex-container">';
            htmlToInsert += '<div class="mdl-slider-background-flex">';
            htmlToInsert += '<div class="mdl-slider-background-flex-inner">';

            // the more of these, the more ranges we can display
            htmlToInsert += '<div class="mdl-slider-background-upper"></div>';

            if (enableWidthWithTransform) {
                htmlToInsert += '<div class="mdl-slider-background-lower mdl-slider-background-lower-withtransform"></div>';
            } else {
                htmlToInsert += '<div class="mdl-slider-background-lower"></div>';
            }

            htmlToInsert += '</div>';
            htmlToInsert += '</div>';
            htmlToInsert += '</div>';
        }

        htmlToInsert += '<div class="sliderBubbleTrack"><div class="sliderBubble hide"></div></div>';

        containerElement.insertAdjacentHTML('beforeend', htmlToInsert);

        this.sliderBubbleTrack = containerElement.querySelector('.sliderBubbleTrack');
        this.backgroundLower = containerElement.querySelector('.mdl-slider-background-lower');
        this.backgroundUpper = containerElement.querySelector('.mdl-slider-background-upper');
        var sliderBubble = containerElement.querySelector('.sliderBubble');

        var hasHideClass = sliderBubble.classList.contains('hide');

        dom.addEventListener(this, 'input', function (e) {
            this.dragging = true;

            updateBubble(this, this.value, sliderBubble);

            if (hasHideClass) {
                sliderBubble.classList.remove('hide');
                hasHideClass = false;
            }
        }, {
            passive: true
        });

        dom.addEventListener(this, 'change', function () {
            this.dragging = false;
            updateValues.call(this);

            sliderBubble.classList.add('hide');
            hasHideClass = true;

        }, {
            passive: true
        });

        dom.addEventListener(this, (window.PointerEvent ? 'pointermove' : 'mousemove'), function (e) {

            if (!this.dragging) {
                var rect = this.sliderBubbleTrack.getBoundingClientRect();
                var clientX = e.clientX;

                var bubbleValue = (clientX - rect.left) / rect.width;
                bubbleValue *= 100;
                if (this.step !== 0) {
                    bubbleValue = Math.round(bubbleValue / this.step) * this.step;
                }
                bubbleValue = Math.min(Math.max(bubbleValue, 0), 100);

                updateBubble(this, bubbleValue, sliderBubble);

                if (hasHideClass) {
                    sliderBubble.classList.remove('hide');
                    hasHideClass = false;
                }
            }

        }, {
            passive: true
        });

        dom.addEventListener(this, (window.PointerEvent ? 'pointerleave' : 'mouseleave'), function () {
            sliderBubble.classList.add('hide');
            hasHideClass = true;
        }, {
            passive: true
        });

        if (!supportsNativeProgressStyle) {

            if (supportsValueSetOverride) {
                this.addEventListener('valueset', updateValues);
            } else {
                startInterval(this);
            }
        }
    };

    /**
     * Keyboard dragging timeout.
     * After this delay "change" event will be fired.
     */
    var KeyboardDraggingTimeout = 1000;

    /**
     * Keyboard dragging timer.
     */
    var keyboardDraggingTimer;

    /**
     * Start keyboard dragging.
     *
     * @param {Object} elem slider itself
     */
    function startKeyboardDragging(elem) {
        elem.keyboardDragging = true;

        clearTimeout(keyboardDraggingTimer);
        keyboardDraggingTimer = setTimeout(function () {
            finishKeyboardDragging(elem);
        }, KeyboardDraggingTimeout);
    }

    /**
     * Finish keyboard dragging.
     *
     * @param {Object} elem slider itself
     */
    function finishKeyboardDragging(elem) {
        clearTimeout(keyboardDraggingTimer);
        keyboardDraggingTimer = undefined;

        elem.keyboardDragging = false;

        var event = new Event('change', {
            bubbles: true,
            cancelable: false
        });
        elem.dispatchEvent(event);
    }

    /**
     * Do step by delta.
     *
     * @param {Object} elem slider itself
     * @param {number} delta step amount
     */
    function stepKeyboard(elem, delta) {
        startKeyboardDragging(elem);

        elem.value = Math.max(elem.min, Math.min(elem.max, parseFloat(elem.value) + delta));

        var event = new Event('input', {
            bubbles: true,
            cancelable: false
        });
        elem.dispatchEvent(event);
    }

    /**
     * Handle KeyDown event
     */
    function onKeyDown(e) {
        switch (keyboardnavigation.getKeyName(e)) {
            case 'ArrowLeft':
            case 'Left':
                stepKeyboard(this, -this.keyboardStepDown || -1);
                e.preventDefault();
                e.stopPropagation();
                break;
            case 'ArrowRight':
            case 'Right':
                stepKeyboard(this, this.keyboardStepUp || 1);
                e.preventDefault();
                e.stopPropagation();
                break;
        }
    }

    /**
     * Enable keyboard dragging.
     */
    EmbySliderPrototype.enableKeyboardDragging = function () {
        if (!this.keyboardDraggingEnabled) {
            this.addEventListener('keydown', onKeyDown);
            this.keyboardDraggingEnabled = true;
        }
    }

    /**
     * Set steps for keyboard input.
     *
     * @param {number} stepDown step to reduce
     * @param {number} stepUp step to increase
     */
    EmbySliderPrototype.setKeyboardSteps = function (stepDown, stepUp) {
        this.keyboardStepDown = stepDown || stepUp || 1;
        this.keyboardStepUp = stepUp || stepDown || 1;
    }

    function setRange(elem, startPercent, endPercent) {

        var style = elem.style;
        style.left = Math.max(startPercent, 0) + '%';

        var widthPercent = endPercent - startPercent;
        style.width = Math.max(Math.min(widthPercent, 100), 0) + '%';
    }

    function mapRangesFromRuntimeToPercent(ranges, runtime) {

        if (!runtime) {
            return [];
        }

        return ranges.map(function (r) {

            return {
                start: (r.start / runtime) * 100,
                end: (r.end / runtime) * 100
            };
        });
    }

    EmbySliderPrototype.setBufferedRanges = function (ranges, runtime, position) {

        var elem = this.backgroundUpper;
        if (!elem) {
            return;
        }

        if (runtime != null) {
            ranges = mapRangesFromRuntimeToPercent(ranges, runtime);

            position = (position / runtime) * 100;
        }

        for (var i = 0, length = ranges.length; i < length; i++) {

            var range = ranges[i];

            if (position != null) {
                if (position >= range.end) {
                    continue;
                }
            }

            setRange(elem, range.start, range.end);
            return;
        }

        setRange(elem, 0, 0);
    };

    EmbySliderPrototype.setIsClear = function (isClear) {

        var backgroundLower = this.backgroundLower;
        if (backgroundLower) {
            if (isClear) {
                backgroundLower.classList.add('mdl-slider-background-lower-clear');
            } else {
                backgroundLower.classList.remove('mdl-slider-background-lower-clear');
            }
        }
    };

    function startInterval(range) {
        var interval = range.interval;
        if (interval) {
            clearInterval(interval);
        }
        range.interval = setInterval(updateValues.bind(range), 100);
    }

    EmbySliderPrototype.detachedCallback = function () {

        var interval = this.interval;
        if (interval) {
            clearInterval(interval);
        }
        this.interval = null;
        this.backgroundUpper = null;
        this.backgroundLower = null;
    };

    document.registerElement('emby-slider', {
        prototype: EmbySliderPrototype,
        extends: 'input'
    });
});
