document.body.addEventListener('htmx:configRequest', (event) => {
        const element = event.detail.elt
        event.detail.parameters['messageType'] = element.dataset.type
        console.log(element.dataset.type)
    }
)