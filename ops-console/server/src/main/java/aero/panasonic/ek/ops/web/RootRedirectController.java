package aero.panasonic.ek.ops.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Redirects the bare `/` URL to the React UI's notifications tab.
 */
@Controller
public class RootRedirectController {

    @GetMapping("/")
    public String root() {
        return "redirect:/index.html";
    }
}
