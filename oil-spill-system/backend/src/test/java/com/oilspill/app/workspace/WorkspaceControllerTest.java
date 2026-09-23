package com.oilspill.app.workspace;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WorkspaceController.class)
class WorkspaceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MongoTemplate mongoTemplate;

    @Test
    void resetWorkspaceDropsEveryCaseCollection() throws Exception {
        when(mongoTemplate.collectionExists("simulation")).thenReturn(true);
        when(mongoTemplate.collectionExists("ground_truth")).thenReturn(true);

        mockMvc.perform(delete("/api/workspace"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESET"))
                .andExpect(jsonPath("$.dropped").isArray())
                .andExpect(jsonPath("$.skipped").isArray());
    }
}
